import json
import logging
import re
from typing import Any

from .ai_media import llm_complete, resolve_chat_endpoint

MAX_SOURCE_CHARS = 120_000
MAX_LLM_CHARS = 40_000
MAX_EPISODES = 30
MAX_ACTS = 80
MAX_CHARACTERS = 40
MAX_SCENES = 40
MAX_PROPS = 40
MAX_EPISODE_SUMMARY = 16_000
VIDEO_ACT_SECONDS = 5.0
SPEECH_CHARS_PER_SECOND = 4.5
ACTION_LINE_SECONDS = 1.2
MAX_SPOKEN_SENTENCE = 22

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是漫剧制片现场的剧本拆解 Agent。把用户上传的小说/剧本/大纲，拆成可直接进入漫剧制作管线的结构化资产。

只输出一个 JSON 对象，不要 Markdown，不要解释。字段必须是：
{
  "title": "作品标题",
  "plot": {
    "logline": "一句话故事",
    "summary": "300-600字全书梗概，按起承转合；这是总览，不是分集剧本",
    "themes": ["主题1", "主题2"],
    "tone": "叙事基调，如：热血、悬疑、甜宠"
  },
  "characters": [
    {
      "name": "角色名",
      "role": "main 或 support",
      "gender": "male 或 female 或 other",
      "ageGroup": "child 或 teen 或 young 或 middle 或 old",
      "description": "外貌、服装、气质，供后续生图",
      "personality": "性格与动机"
    }
  ],
  "scenes": [
    {
      "name": "场景名",
      "location": "地点",
      "time": "日/夜/晨/黄昏等",
      "description": "空间、光线、氛围，供后续生图"
    }
  ],
  "props": [
    {
      "name": "道具名",
      "type": "weapon 或 prop 或 clothing 或 decoration",
      "description": "外形与叙事功能"
    }
  ],
  "episodes": [
    {
      "index": 1,
      "name": "第01集 标题",
      "summary": "本集可拍剧情：按场次写清动作、冲突和关键对白，不要压成一句话梗概",
      "characterNames": ["出场人物名"],
      "sceneNames": ["用到的场景名"],
      "propNames": ["用到的道具名"]
    }
  ]
}

规则：
- 人物、场景、道具名称必须前后一致，分集里的名字要从上面的列表引用。
- 短剧按情节自然分集；已有「第X集」标记时尊重原文。
- plot.summary 才是全书梗概。episodes[].summary 是分集剧本，必须保留场次、动作和关键对白，禁止写成「起/承/转/合」四段式缩写。
- 原文本身就是一集或两场以内的短稿：整篇作为一集，summary 写入原文情节（可整理换行），不要再压缩。
- 长稿每集 summary 要写到能单独拍摄，优先保留原文对白，不要只写 150 字大纲。
- 不要虚构原文没有的人物、场景、道具、分集。
- 原文没写明的性别、年龄、主配角、时段、道具类型，对应字段输出空字符串，不要猜测填默认值。
- 原文没有外貌/性格就不要编描述，description、personality 留空。
- 输出必须是合法 JSON。
"""

GENDER_MAP = {
    "男": "male",
    "男性": "male",
    "male": "male",
    "m": "male",
    "女": "female",
    "女性": "female",
    "female": "female",
    "f": "female",
}
AGE_MAP = {
    "儿童": "child",
    "小孩": "child",
    "child": "child",
    "少年": "teen",
    "少女": "teen",
    "teen": "teen",
    "青年": "young",
    "年轻": "young",
    "young": "young",
    "中年": "middle",
    "middle": "middle",
    "老年": "old",
    "老人": "old",
    "old": "old",
}
ROLE_MAP = {
    "主角": "main",
    "主要": "main",
    "男主": "main",
    "女主": "main",
    "main": "main",
    "protagonist": "main",
    "配角": "support",
    "次要": "support",
    "support": "support",
    "supporting": "support",
}
PROP_TYPE_MAP = {
    "武器": "weapon",
    "weapon": "weapon",
    "服装": "clothing",
    "服饰": "clothing",
    "衣着": "clothing",
    "clothing": "clothing",
    "装饰": "decoration",
    "场景装饰": "decoration",
    "decoration": "decoration",
    "道具": "prop",
    "物品": "prop",
    "prop": "prop",
}

EPISODE_HEADING = re.compile(
    r"(?m)^(?:#{1,3}\s*)?(第[0-9一二三四五六七八九十百零〇两]+[集话章]|Episode\s*\d+|EP\.?\s*\d+)([^\n]*)",
    re.IGNORECASE,
)
DIALOGUE_SPEAKER = re.compile(r"(?m)^[\s>*-]*([A-Za-z0-9_\u4e00-\u9fff]{2,12})[：:]")
ACT_HEADING = re.compile(
    r"(?m)^(?:#{1,3}\s*)?(场景[0-9一二三四五六七八九十百]+[^\n]*|第[0-9一二三四五六七八九十百]+[场幕][^\n]*)"
)
CN_ACT_INDEX = "一二三四五六七八九十"
DIALOGUE_UNIT = re.compile(
    r"^(?P<prefix>(?P<name>[A-Za-z0-9_\u4e00-\u9fff]{1,12})[^\n：:]{0,40}[：:])(?P<speech>.*)$"
)


def _clip(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "…"


def _as_list(value: Any) -> list:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _map_enum(value: Any, mapping: dict[str, str]) -> str:
    compact = _as_str(value)
    if not compact:
        return ""
    raw = compact.lower()
    if raw in mapping:
        return mapping[raw]
    if compact in mapping:
        return mapping[compact]
    for key, mapped in mapping.items():
        if key and key in compact:
            return mapped
    return ""


def extract_json_object(text: str) -> dict | None:
    if not text:
        return None
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    blob = cleaned[start : end + 1]
    try:
        data = json.loads(blob)
    except json.JSONDecodeError:
        blob = re.sub(r",\s*([}\]])", r"\1", blob)
        try:
            data = json.loads(blob)
        except json.JSONDecodeError:
            return None
    return data if isinstance(data, dict) else None


def _normalize_character(item: Any, index: int) -> dict | None:
    if isinstance(item, str):
        item = {"name": item}
    if not isinstance(item, dict):
        return None
    name = _clip(_as_str(item.get("name") or item.get("characterName")), 64)
    if not name:
        return None
    description = _clip(_as_str(item.get("description")), 800)
    return {
        "name": name,
        "role": _map_enum(item.get("role") or item.get("characterRole"), ROLE_MAP),
        "gender": _map_enum(item.get("gender"), GENDER_MAP),
        "ageGroup": _map_enum(item.get("ageGroup") or item.get("age"), AGE_MAP),
        "description": description,
        "personality": _clip(_as_str(item.get("personality")), 240),
    }


def _normalize_scene(item: Any, index: int) -> dict | None:
    if isinstance(item, str):
        item = {"name": item}
    if not isinstance(item, dict):
        return None
    name = _clip(_as_str(item.get("name") or item.get("location")), 64)
    if not name:
        return None
    location = _clip(_as_str(item.get("location")), 64)
    description = _clip(_as_str(item.get("description")), 800)
    return {
        "name": name,
        "location": location,
        "time": _clip(_as_str(item.get("time")), 32),
        "description": description,
    }


def _normalize_prop(item: Any, index: int) -> dict | None:
    if isinstance(item, str):
        item = {"name": item}
    if not isinstance(item, dict):
        return None
    name = _clip(_as_str(item.get("name")), 64)
    if not name:
        return None
    return {
        "name": name,
        "type": _map_enum(item.get("type"), PROP_TYPE_MAP),
        "description": _clip(_as_str(item.get("description")), 400),
    }


def _normalize_episode(item: Any, index: int) -> dict | None:
    if isinstance(item, str):
        item = {"summary": item, "name": f"第{index + 1:02d}集"}
    if not isinstance(item, dict):
        return None
    name = _clip(_as_str(item.get("name")), 80)
    summary = _clip(_as_str(item.get("summary") or item.get("description") or item.get("plot")), MAX_EPISODE_SUMMARY)
    if not name and not summary:
        return None
    return {
        "index": int(item.get("index") or index + 1),
        "name": name,
        "summary": summary,
        "characterNames": [_clip(_as_str(n), 64) for n in _as_list(item.get("characterNames")) if _as_str(n)],
        "sceneNames": [_clip(_as_str(n), 64) for n in _as_list(item.get("sceneNames")) if _as_str(n)],
        "propNames": [_clip(_as_str(n), 64) for n in _as_list(item.get("propNames")) if _as_str(n)],
    }


def strip_script_preamble(text: str) -> str:
    text = re.sub(r"(?m)^剧名[：:].*\n?", "", text or "")
    text = re.sub(
        r"(?m)^人物[：:][\s\S]*?(?=^场景|^第[0-9一二三四五六七八九十]+[场幕集]|^地点|^内景|^外景|\Z)",
        "",
        text,
    )
    return text.strip()


def _act_label(index: int, heading: str) -> str:
    numeral = CN_ACT_INDEX[index] if index < len(CN_ACT_INDEX) else str(index + 1)
    place = _place_from_heading(heading)
    return f"第{numeral}幕 · {place}" if place else f"第{numeral}幕"


def _place_from_heading(heading: str) -> str:
    place = re.sub(r"^场景[0-9一二三四五六七八九十百]+[：:\s]*", "", heading or "")
    return re.sub(r"^第[0-9一二三四五六七八九十百]+[场幕]\s*", "", place).strip(" ：:")


def _spoken_len(text: str) -> int:
    return len(re.sub(r"\s+", "", text or ""))


def _is_filler_speech(text: str) -> bool:
    return not re.sub(r"[\s。！？!?…·\-—,.，、；;]+", "", text or "")


def _split_spoken(speech: str) -> list[str]:
    chunks = [part.strip() for part in re.split(r"(?<=[。！？])", speech or "") if part.strip()]
    if not chunks:
        return []
    out: list[str] = []
    for chunk in chunks:
        if _spoken_len(chunk) <= MAX_SPOKEN_SENTENCE:
            if not _is_filler_speech(chunk):
                out.append(chunk)
            continue
        pieces = [part.strip() for part in re.split(r"(?<=[，、；,;])", chunk) if part.strip()]
        buf = ""
        for piece in pieces or [chunk]:
            if buf and _spoken_len(buf + piece) > MAX_SPOKEN_SENTENCE:
                if not _is_filler_speech(buf):
                    out.append(buf)
                buf = piece
            else:
                buf += piece
        if buf and not _is_filler_speech(buf):
            out.append(buf)
    return out


def explode_script_units(body: str) -> list[str]:
    units: list[str] = []
    for raw in re.split(r"\n+", body or ""):
        line = raw.strip()
        if not line:
            continue
        match = DIALOGUE_UNIT.match(line)
        if not match:
            units.append(line)
            continue
        spoken = _split_spoken(match.group("speech"))
        if not spoken:
            units.append(line)
            continue
        prefix = match.group("prefix")
        units.extend(f"{prefix}{part}" for part in spoken)
    return units


def estimate_act_seconds(text: str) -> float:
    units = explode_script_units(text)
    if not units and (text or "").strip():
        units = [text.strip()]
    seconds = 0.0
    for unit in units:
        match = DIALOGUE_UNIT.match(unit)
        if not match:
            seconds += ACTION_LINE_SECONDS
            continue
        seconds += _spoken_len(match.group("speech")) / SPEECH_CHARS_PER_SECOND
    return seconds


def pack_video_beats(body: str) -> list[str]:
    units = explode_script_units(body)
    if not units:
        return [body.strip()] if (body or "").strip() else []
    beats: list[str] = []
    current: list[str] = []
    cost = 0.0
    for unit in units:
        unit_cost = estimate_act_seconds(unit)
        if current and cost + unit_cost > VIDEO_ACT_SECONDS:
            beats.append("\n".join(current))
            current = [unit]
            cost = unit_cost
        else:
            current.append(unit)
            cost += unit_cost
    if current:
        beats.append("\n".join(current))
    return beats


def split_plot_acts(source_text: str) -> list[dict]:
    text = strip_script_preamble(source_text)
    if not text:
        return []
    matches = list(ACT_HEADING.finditer(text))
    scenes: list[tuple[str, str]] = []
    if not matches:
        scenes.append(("", text))
    else:
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
            heading = (match.group(1) or "").strip()
            body = text[match.end() : end].strip()
            if heading or body:
                scenes.append((heading, body))
    acts: list[dict] = []
    for heading, body in scenes:
        for beat in pack_video_beats(body) or [body]:
            summary = (beat or "").strip()
            if not heading and not summary:
                continue
            acts.append(
                {
                    "index": len(acts) + 1,
                    "name": _act_label(len(acts), heading),
                    "heading": heading,
                    "summary": summary,
                }
            )
    return acts[:MAX_ACTS]


def act_speakers(act_text: str, character_names: list[str]) -> list[str]:
    found: list[str] = []
    seen: set[str] = set()
    for name in character_names:
        key = (name or "").strip()
        if not key or key in seen:
            continue
        if re.search(rf"(?m)^\s*@?{re.escape(key)}", act_text or ""):
            seen.add(key)
            found.append(key)
    return found


def act_cast(act_text: str, character_names: list[str]) -> list[str]:
    speakers = act_speakers(act_text, character_names)
    if speakers:
        return speakers
    found: list[str] = []
    text = act_text or ""
    for name in character_names:
        key = (name or "").strip()
        if key and key in text and key not in found:
            found.append(key)
    return found


def split_headed_episodes(source_text: str) -> list[dict]:
    text = (source_text or "").strip()
    if not text:
        return []
    matches = list(EPISODE_HEADING.finditer(text))
    if not matches:
        return []
    episodes: list[dict] = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        heading = (match.group(1) + " " + (match.group(2) or "")).strip()
        body = text[match.end() : end].strip()
        episodes.append({"name": heading[:80], "summary": body, "index": index + 1})
    return episodes


def _match_headed_body(episode: dict, headed: list[dict]) -> str:
    name = _as_str(episode.get("name"))
    if not name:
        return ""
    key = name.casefold()
    for src in headed:
        src_name = _as_str(src.get("name"))
        if not src_name:
            continue
        src_key = src_name.casefold()
        if key == src_key or key in src_key or src_key in key:
            return src.get("summary") or ""
    return ""


def restore_episode_summaries(episodes: list[dict], source_text: str) -> list[dict]:
    """Replace compressed episode synopses with the original scene/dialogue body when available."""
    text = (source_text or "").strip()
    headed = split_headed_episodes(text)
    cleaned: list[dict] = []
    for item in episodes or []:
        if isinstance(item, dict):
            cleaned.append(dict(item))
        elif _as_str(item):
            cleaned.append({"summary": _as_str(item)})
    episodes = cleaned

    if not episodes:
        if headed:
            return [
                {
                    "index": src["index"],
                    "name": src["name"] or f"第{src['index']:02d}集",
                    "summary": _clip(src["summary"], MAX_EPISODE_SUMMARY),
                    "characterNames": [],
                    "sceneNames": [],
                    "propNames": [],
                }
                for src in headed[:MAX_EPISODES]
            ]
        if text:
            return [
                {
                    "index": 1,
                    "name": "第01集",
                    "summary": _clip(text, MAX_EPISODE_SUMMARY),
                    "characterNames": [],
                    "sceneNames": [],
                    "propNames": [],
                }
            ]
        return []

    if headed:
        if len(headed) == len(episodes):
            for episode, src in zip(episodes, headed):
                body = src.get("summary") or ""
                if body and len(body) > len(episode.get("summary") or ""):
                    episode["summary"] = _clip(body, MAX_EPISODE_SUMMARY)
                if not _as_str(episode.get("name")):
                    episode["name"] = src.get("name") or ""
            return episodes
        for episode in episodes:
            body = _match_headed_body(episode, headed)
            if body and len(body) > len(episode.get("summary") or ""):
                episode["summary"] = _clip(body, MAX_EPISODE_SUMMARY)
        return episodes

    if len(episodes) == 1 and text and len(text) > len(episodes[0].get("summary") or ""):
        episodes[0]["summary"] = _clip(text, MAX_EPISODE_SUMMARY)
        if not _as_str(episodes[0].get("name")):
            episodes[0]["name"] = "第01集"
    return episodes


def _dedupe_by_name(items: list[dict], limit: int) -> list[dict]:
    seen: set[str] = set()
    result: list[dict] = []
    for item in items:
        key = item.get("name", "").casefold()
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(item)
        if len(result) >= limit:
            break
    return result


def normalize_parse_result(raw: dict, fallback_title: str, source_text: str) -> dict:
    plot_raw = raw.get("plot") if isinstance(raw.get("plot"), dict) else {}
    summary = _clip(_as_str(plot_raw.get("summary") or raw.get("summary")), 2000)
    characters = [
        item
        for index, value in enumerate(_as_list(raw.get("characters") or raw.get("people")))
        if (item := _normalize_character(value, index))
    ]
    scenes = [
        item
        for index, value in enumerate(_as_list(raw.get("scenes") or raw.get("locations")))
        if (item := _normalize_scene(value, index))
    ]
    props = [
        item
        for index, value in enumerate(_as_list(raw.get("props") or raw.get("objects")))
        if (item := _normalize_prop(value, index))
    ]
    episodes = [
        item
        for index, value in enumerate(_as_list(raw.get("episodes")))
        if (item := _normalize_episode(value, index))
    ]
    characters = _dedupe_by_name(characters, MAX_CHARACTERS)
    scenes = _dedupe_by_name(scenes, MAX_SCENES)
    props = _dedupe_by_name(props, MAX_PROPS)
    episodes = restore_episode_summaries(episodes[:MAX_EPISODES], source_text)
    for index, episode in enumerate(episodes):
        episode["index"] = index + 1
        if not episode.get("name"):
            episode["name"] = f"第{index + 1:02d}集"
    title = _clip(_as_str(raw.get("title") or fallback_title), 80)
    themes = [_clip(_as_str(t), 32) for t in _as_list(plot_raw.get("themes")) if _as_str(t)][:6]
    logline = _clip(_as_str(plot_raw.get("logline")), 160)
    return {
        "title": title,
        "plot": {
            "logline": logline,
            "summary": summary,
            "themes": themes,
            "tone": _clip(_as_str(plot_raw.get("tone")), 40),
        },
        "characters": characters,
        "scenes": scenes,
        "props": props,
        "episodes": episodes,
    }


def heuristic_parse(source_text: str, title: str) -> dict:
    text = source_text.strip()
    episodes_raw = split_headed_episodes(text)
    if not episodes_raw and len(text) <= 4000:
        episodes_raw = [{"name": "", "summary": text, "index": 1}]
    elif not episodes_raw:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
        chunk: list[str] = []
        length = 0
        index = 1
        for para in paragraphs or [text]:
            chunk.append(para)
            length += len(para)
            if length >= 900:
                episodes_raw.append({"name": "", "summary": "\n".join(chunk), "index": index})
                index += 1
                chunk = []
                length = 0
                if index > MAX_EPISODES:
                    break
        if chunk and index <= MAX_EPISODES:
            episodes_raw.append({"name": "", "summary": "\n".join(chunk), "index": index})

    speakers: list[str] = []
    seen: set[str] = set()
    for speaker in DIALOGUE_SPEAKER.findall(text):
        if speaker in {"旁白", "画外音", "OS", "N", "场景", "地点"} or speaker in seen:
            continue
        seen.add(speaker)
        speakers.append(speaker)
        if len(speakers) >= 12:
            break

    location_hits = re.findall(r"(?m)^[\s>#*-]*(?:场景|地点|内景|外景)[：:\s]+(.+)$", text)
    scenes_raw = [{"name": loc.strip()[:64], "description": loc.strip()} for loc in location_hits[:MAX_SCENES]]
    characters_raw = [{"name": name} for name in speakers]
    raw = {
        "title": title,
        "plot": {"logline": "", "summary": "", "themes": [], "tone": ""},
        "characters": characters_raw,
        "scenes": scenes_raw,
        "props": [],
        "episodes": episodes_raw,
    }
    return normalize_parse_result(raw, title, text)


async def parse_script(source_text: str, title: str) -> dict:
    text = (source_text or "").strip()
    if not text:
        raise ValueError("剧本内容为空")
    if len(text) > MAX_SOURCE_CHARS:
        text = text[:MAX_SOURCE_CHARS]

    fallback = heuristic_parse(text, title)
    if not resolve_chat_endpoint():
        fallback["agent"] = {"provider": "heuristic", "model": "rules"}
        return fallback

    llm_input = text if len(text) <= MAX_LLM_CHARS else text[:MAX_LLM_CHARS] + "\n\n[原文过长，以上为截取部分]"
    user_prompt = f"作品参考标题：{title or ''}\n\n剧本原文：\n{llm_input}"
    content, model = await llm_complete(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        timeout=180,
        fail_on_error=False,
    )
    parsed = extract_json_object(content or "")
    if not parsed:
        fallback["agent"] = {"provider": "heuristic", "model": model or "rules", "note": "模型未返回合法 JSON，已使用规则拆解"}
        return fallback
    result = normalize_parse_result(parsed, title, text)
    provider = "xai"
    if model and model.startswith("grok"):
        provider = "xai"
    elif model and "qwen" in model:
        provider = "openai-compatible"
    else:
        provider = "llm"
    result["agent"] = {"provider": provider, "model": model or "unknown"}
    logger.info(
        "script_parse title=%s model=%s episodes=%s summary_chars=%s",
        result.get("title"),
        model,
        len(result.get("episodes") or []),
        [len(ep.get("summary") or "") for ep in result.get("episodes") or []],
    )
    return result
