from app.script_agent import (
    VIDEO_ACT_SECONDS,
    act_cast,
    act_speakers,
    estimate_act_seconds,
    heuristic_parse,
    normalize_parse_result,
    restore_episode_summaries,
    split_plot_acts,
    strip_script_preamble,
)

SHORT_SCRIPT = """剧名：透风的家

人物：
林晓：25岁，女儿。
老林：52岁，父亲，老实巴交。
秀琴：50岁，母亲，嗓门大，藏不住事。
老张：55岁，同楼层邻居。

场景一：小区单元门前
傍晚，老林拎着塑料袋装的豆腐和青菜，低头往单元门里走。
老张刚好掐灭烟头推车出来，俩人打了个照面。
老张咧嘴一笑：老林，下班挺早啊。
老林客气应声：哎，老张，出门遛弯？
老张扫了一眼老林的裤脚，眼神带着戏谑：降温了，你那条右腿破了俩洞的秋裤还顶得住不？
老林浑身一僵：你……你听谁扯淡的？
"""

HEADED_SCRIPT = """雨夜来客

第01集 别开门
林深把诊所的铁门闩死，对苏晚说今晚谁来都别开。
林深：钥匙在我这儿。你睡吧。
苏晚：可是门外真的有人。

第02集 钟声
苏晚还是跟了上去。两人走进废弃钟楼。
苏晚：她长得像我妈。

第03集 来客
撑伞女人将一张旧照从门缝推入。
女人：钥匙该还回来了。
"""


def test_restore_replaces_thin_single_episode_with_full_script():
    episodes = restore_episode_summaries(
        [{"name": "第01集 秋裤上的洞", "summary": "老林被邻居调侃秋裤破洞，回家质问妻子。"}],
        SHORT_SCRIPT,
    )
    assert len(episodes) == 1
    assert "你听谁扯淡" in episodes[0]["summary"]
    assert "秋裤" in episodes[0]["summary"]
    assert len(episodes[0]["summary"]) > 200


def test_restore_headed_episodes_keep_original_dialogue():
    thin = [
        {"name": "第01集 别开门", "summary": "林深叮嘱苏晚别开门。"},
        {"name": "第02集 钟声", "summary": "两人进入钟楼。"},
        {"name": "第03集 来客", "summary": "门外有人送来旧照。"},
    ]
    episodes = restore_episode_summaries(thin, HEADED_SCRIPT)
    assert len(episodes) == 3
    assert "钥匙在我这儿" in episodes[0]["summary"]
    assert "她长得像我妈" in episodes[1]["summary"]
    assert "钥匙该还回来了" in episodes[2]["summary"]


def test_normalize_parse_result_recovers_short_script():
    result = normalize_parse_result(
        {
            "title": "透风的家",
            "plot": {"summary": "起：秋裤破洞。承：回家吵架。转：痔疮膏。合：死寂。"},
            "episodes": [{"name": "第01集 秋裤上的洞", "summary": "老林下班回家被嘲笑。"}],
            "characters": [{"name": "老林"}],
        },
        "透风的家",
        SHORT_SCRIPT,
    )
    assert "你听谁扯淡" in result["episodes"][0]["summary"]
    assert result["plot"]["summary"].startswith("起")


def test_heuristic_keeps_short_unheaded_script_as_one_episode():
    result = heuristic_parse(SHORT_SCRIPT, "透风的家")
    assert len(result["episodes"]) == 1
    assert "你听谁扯淡" in result["episodes"][0]["summary"]


def test_multi_episode_novel_without_headings_keeps_llm_summaries():
    source = "甲。" * 2000
    episodes = restore_episode_summaries(
        [
            {"name": "第01集", "summary": "甲登场，发现密室。"},
            {"name": "第02集", "summary": "乙叛变，甲逃亡。"},
        ],
        source,
    )
    assert episodes[0]["summary"] == "甲登场，发现密室。"
    assert episodes[1]["summary"] == "乙叛变，甲逃亡。"


HOUSE_SCRIPT = """剧名：透风的家

人物：
林晓：25岁，女儿。
老林：52岁，父亲，老实巴交。
秀琴：50岁，母亲，嗓门大，藏不住事。
老张：55岁，同楼层邻居。

场景一：小区单元门前
傍晚，老林拎着塑料袋装的豆腐和青菜，低头往单元门里走。
老张咧嘴一笑：老林，下班挺早啊。
老林客气应声：哎，老张，出门遛弯？
老张：降温了，你那条右腿破了俩洞的秋裤还顶得住不？
老林浑身一僵：你……你听谁扯淡的？
老张嘿嘿笑：秀琴在楼下跟跳操的那帮老娘们唠嗑。

场景二：林家客厅
林晓转头：爸，你跟门较什么劲？
老林一边扯鞋带一边喘粗气：你妈呢？让她出来！
秀琴端着电饭锅内胆从厨房出来：鬼叫什么？
林晓：妈，你能不能收敛点？
"""


def test_strip_preamble_drops_title_and_cast():
    cleaned = strip_script_preamble(HOUSE_SCRIPT)
    assert "剧名" not in cleaned
    assert not cleaned.startswith("人物")
    assert "场景一" in cleaned


def test_split_plot_acts_keeps_speakers_per_scene():
    names = ["林晓", "老林", "秀琴", "老张"]
    acts = split_plot_acts(HOUSE_SCRIPT)
    assert len(acts) >= 2
    assert acts[0]["name"].startswith("第一幕")
    assert "小区单元门前" in acts[0]["name"]
    assert "剧名" not in acts[0]["summary"]
    hallway = [act for act in acts if "小区单元门前" in act["name"]]
    living = [act for act in acts if "林家客厅" in act["name"]]
    assert hallway
    assert living
    assert any("你听谁扯淡" in act["summary"] for act in hallway)
    assert any("秀琴在楼下" in act["summary"] for act in hallway)
    hallway_speakers = {name for act in hallway for name in act_speakers(act["summary"], names)}
    assert hallway_speakers <= {"老林", "老张"}
    assert "秀琴" not in hallway_speakers
    assert act_speakers("@老林客气应声：哎", names) == ["老林"]
    living_speakers = {name for act in living for name in act_speakers(act["summary"], names)}
    assert {"林晓", "老林", "秀琴"} <= living_speakers
    assert all(estimate_act_seconds(act["summary"]) <= VIDEO_ACT_SECONDS + 0.2 for act in acts)


FULL_HOUSE_SCRIPT = """剧名：透风的家

人物：
林晓：25岁，女儿。
老林：52岁，父亲，老实巴交。
秀琴：50岁，母亲，嗓门大，藏不住事。
老张：55岁，同楼层邻居。

场景一：小区单元门前
傍晚，老林拎着塑料袋装的豆腐和青菜，低头往单元门里走。
老张刚好掐灭烟头推车出来，俩人打了个照面。
老张咧嘴一笑：老林，下班挺早啊。
老林客气应声：哎，老张，出门遛弯？
老张扫了一眼老林的裤脚，眼神带着戏谑：降温了，你那条右腿破了俩洞的秋裤还顶得住不？实在不行换条新的，几十块钱的事，别硬扛啊！
老林浑身一僵，脚下差点踩空，脸瞬间涨成猪肝色：你……你听谁扯淡的？
老张嘿嘿笑：秀琴在楼下跟跳操的那帮老娘们唠嗑，嗓门大得整栋楼都听得见。行了，快上楼换了吧！
老林站在原地咬着牙，拎着菜快步冲进电梯。

场景二：林家客厅
防盗门被重重甩上，老林把菜袋子往鞋柜上一摔。
林晓正盘腿坐在地毯上看手机，被关门声吓了一跳。
林晓转头：爸，你跟门较什么劲？
老林一边扯鞋带一边喘粗气：你妈呢？让她出来！我这张脸在小区里彻底扫地了！连五楼老张都知道我秋裤上有俩洞，当面调侃我！
秀琴端着电饭锅内胆从厨房出来，瞪了老林一眼：鬼叫什么？老张知道了又能怎么着？我那是跟人聊天赶巧说到男人过日子节俭，顺嘴提了一句，你身上少块肉了？
老林气得胸口起伏：你提什么不好提我裤头破洞？要不要把我昨晚拉肚子也印成传单发下去？
秀琴撇嘴：身正不怕影子斜，就你心眼比针鼻还小。
林晓揉着太阳穴站起来：妈，你能不能收敛点？家里的私事你天天往外倒，我都嫌臊得慌。
秀琴拿起筷子摆盘，语气理所当然：行了，一家人整天藏着掖着干嘛。对了晓晓，上午你张婶发微信问，你上周去相亲的那个男的到底成没成，我说那男的头顶有点秃，你没瞧上。
林晓脑子嗡的一声：妈！那是我进门随口跟你吐的苦水，张婶怎么会知道？
秀琴拉开椅子坐下：我早上在菜市场碰见她，顺口唠了两句家常，人家也是好心关心你。
林晓一口气堵在胸口还没顺过来，手机突然震动。
免提外放里传出闺蜜的声音：晓晓，你赶紧看看家族群！你二姨在群里发偏方呢，问你痔疮膏抹了管不管用，说是你妈今早发语音问她哪个牌子见效快……
林晓僵在原地，转过头死死盯着秀琴。
秀琴眼神飘忽了一下，抓起筷子低头夹菜：我……我这不是看你坐立不安的，想帮你找个有经验的问问么……
老林一屁股瘫在沙发上闭上眼，林晓抓起桌上的抱枕狠狠砸在地毯上。
"""


def test_full_house_script_beats_fit_five_seconds():
    names = ["林晓", "老林", "秀琴", "老张"]
    acts = split_plot_acts(FULL_HOUSE_SCRIPT)
    assert len(acts) > 2
    assert all(estimate_act_seconds(act["summary"]) <= VIDEO_ACT_SECONDS + 0.2 for act in acts)
    assert any("秋裤" in act["summary"] for act in acts)
    assert any("痔疮膏" in act["summary"] for act in acts)
    first = acts[0]["summary"]
    assert act_cast(first, names)
    assert "秀琴" not in act_speakers(first, names)
