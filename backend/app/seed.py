from datetime import timedelta

from sqlalchemy.orm import Session

from . import models
from .config import settings
from .security import hash_password
from .util import now


def seed_if_empty(db: Session) -> None:
    if db.query(models.Role).count() == 0:
        db.add_all(
            [
                models.Role(
                    id=1,
                    code="super_admin",
                    name="超级管理员",
                    can_create_organization=True,
                    can_create_project=True,
                    can_manage_project_members=True,
                    list_all_projects=True,
                    list_organization_projects=True,
                ),
                models.Role(
                    id=2,
                    code="admin",
                    name="管理员",
                    can_create_organization=False,
                    can_create_project=True,
                    can_manage_project_members=True,
                    list_all_projects=False,
                    list_organization_projects=True,
                ),
                models.Role(
                    id=3,
                    code="employee",
                    name="员工",
                    can_create_organization=False,
                    can_create_project=True,
                    can_manage_project_members=False,
                    list_all_projects=False,
                    list_organization_projects=False,
                ),
            ]
        )
        db.flush()

    if db.query(models.User).filter_by(email=settings.seed_email).first():
        if db.query(models.BillingEnterpriseQuota).count() == 0:
            db.add(models.BillingEnterpriseQuota(id=1))
        return

    user = models.User(
        role_id=1,
        username=settings.seed_username,
        email=settings.seed_email,
        password_hash=hash_password(settings.seed_password),
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={settings.seed_username}",
        credits=10000,
    )
    db.add(user)
    db.flush()

    org = models.Organization(name="MangaCanvas Studio", created_by=user.id)
    db.add(org)
    db.flush()
    db.add(models.OrganizationMember(organization_id=org.id, user_id=user.id, assigned_by=user.id))
    db.add(models.BillingEnterpriseQuota(id=1, quota_limit=1_000_000, quota_consumed=0))
    db.add(
        models.BillingOrganizationQuota(
            organization_id=org.id, quota_percent=100, quota_limit=1_000_000, quota_consumed=0
        )
    )
    db.add(
        models.BillingLedger(
            organization_id=org.id,
            user_id=user.id,
            entry_type="earn",
            amount=10000,
            balance_after=10000,
            description="初始积分",
        )
    )


DEMO_PASSWORD = "123456"

COVERS = {
    "fog": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=800&fit=crop",
    "star": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200&h=800&fit=crop",
    "moon": "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=1200&h=800&fit=crop",
}
PORTRAITS = {
    "qingyu": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=800&fit=crop",
    "chijin": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&h=800&fit=crop",
    "acha": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&h=800&fit=crop&sat=-20",
    "captain": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=800&fit=crop",
    "navigator": "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=800&fit=crop",
}
SCENES = {
    "mountain": "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&h=800&fit=crop",
    "street": "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1200&h=800&fit=crop",
    "tavern": "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200&h=800&fit=crop",
    "harbor": "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1200&h=800&fit=crop",
    "bridge": "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1200&h=800&fit=crop",
}
PROPS = {
    "fan": "https://images.unsplash.com/photo-1526318896980-cf78c088247c?w=800&h=800&fit=crop",
    "sword": "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&h=800&fit=crop",
    "umbrella": "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&h=800&fit=crop",
    "compass": "https://images.unsplash.com/photo-1526498460520-4c246339dccb?w=800&h=800&fit=crop",
}


def _ensure_user(db: Session, *, username: str, email: str, role_id: int, credits: int) -> models.User:
    user = db.query(models.User).filter_by(email=email).first()
    if user:
        return user
    user = models.User(
        role_id=role_id,
        username=username,
        email=email,
        password_hash=hash_password(DEMO_PASSWORD),
        avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}",
        credits=credits,
    )
    db.add(user)
    db.flush()
    return user


def _join_org(db: Session, org_id: int, user_id: int, assigned_by: int) -> None:
    exists = db.query(models.OrganizationMember).filter_by(organization_id=org_id, user_id=user_id).first()
    if not exists:
        db.add(models.OrganizationMember(organization_id=org_id, user_id=user_id, assigned_by=assigned_by))


def _add_member(db: Session, project: models.Project, user_id: int, role: str, assigned_by: int) -> None:
    exists = db.query(models.ProjectMember).filter_by(project_id=project.id, user_id=user_id).first()
    if not exists:
        db.add(
            models.ProjectMember(
                project_id=project.id,
                user_id=user_id,
                organization_id=project.organization_id,
                role=role,
                assigned_by=assigned_by,
            )
        )


def seed_demo_content(db: Session) -> None:
    if db.query(models.Project).filter_by(name="雾隐少年").first():
        return

    admin = db.query(models.User).filter_by(email=settings.seed_email).first()
    org = db.query(models.Organization).order_by(models.Organization.id.asc()).first()
    if not admin or not org:
        return

    chen = _ensure_user(db, username="陈晓明", email="chenxiaoming@artofhacking.com", role_id=2, credits=4000)
    lin = _ensure_user(db, username="林夏", email="linxia@artofhacking.com", role_id=3, credits=1200)
    zhou = _ensure_user(db, username="周衡", email="zhouheng@artofhacking.com", role_id=3, credits=800)
    for member in (chen, lin, zhou):
        _join_org(db, org.id, member.id, admin.id)
        db.add(
            models.BillingLedger(
                organization_id=org.id,
                user_id=member.id,
                entry_type="earn",
                amount=member.credits,
                balance_after=member.credits,
                description="入职发放积分",
            )
        )

    t = now()
    fog = models.Project(
        organization_id=org.id,
        name="雾隐少年",
        description="水墨仙侠漫剧。青羽入书院、遇赤烬，在雾隐后山追查失踪的剑谱。",
        cover_image=COVERS["fog"],
        status="in-progress",
        is_public=False,
        owner_id=admin.id,
        created_at=t - timedelta(days=18),
        updated_at=t - timedelta(hours=3),
    )
    star = models.Project(
        organization_id=org.id,
        name="星港夜航",
        description="科幻航海。星港领航员带着失忆船长，穿过尘暴带寻找故乡坐标。",
        cover_image=COVERS["star"],
        status="draft",
        is_public=False,
        owner_id=chen.id,
        created_at=t - timedelta(days=6),
        updated_at=t - timedelta(days=1),
    )
    moon = models.Project(
        organization_id=org.id,
        name="赤月契约",
        description="已完结短篇。赤月夜，契约师与妖物立约，换来一座城的黎明。",
        cover_image=COVERS["moon"],
        status="completed",
        is_public=True,
        owner_id=admin.id,
        created_at=t - timedelta(days=40),
        updated_at=t - timedelta(days=12),
    )
    db.add_all([fog, star, moon])
    db.flush()

    for project, owner_id in ((fog, admin.id), (star, chen.id), (moon, admin.id)):
        db.add(
            models.BillingProjectQuota(
                project_id=project.id, quota_percent=30, quota_limit=300000, quota_consumed=12000
            )
        )
        _add_member(db, project, owner_id, "owner", admin.id)
    _add_member(db, fog, chen.id, "editor", admin.id)
    _add_member(db, fog, lin.id, "editor", admin.id)
    _add_member(db, fog, zhou.id, "viewer", admin.id)
    _add_member(db, star, lin.id, "editor", chen.id)
    _add_member(db, moon, chen.id, "viewer", admin.id)

    qingyu = models.Character(
        organization_id=org.id,
        project_id=fog.id,
        name="青羽",
        role="main",
        gender="female",
        age_group="teen",
        style="水墨少年",
        description="雾隐书院新生。持青羽折扇，性格冷静，能看见他人看不见的雾中残影。",
        avatar=PORTRAITS["qingyu"],
        reference_images=[PORTRAITS["qingyu"]],
        model_id="qwen-image-2.0",
        seed="fog-qingyu",
        creation_mode="quick",
        usage_count=6,
    )
    chijin = models.Character(
        organization_id=org.id,
        project_id=fog.id,
        name="赤烬",
        role="main",
        gender="male",
        age_group="young",
        style="热血武侠",
        description="流浪剑客。赤烬长刀从不离身，嘴上不饶人，关键时刻总会挡在青羽前面。",
        avatar=PORTRAITS["chijin"],
        reference_images=[PORTRAITS["chijin"]],
        model_id="qwen-image-2.0",
        creation_mode="quick",
        usage_count=4,
    )
    acha = models.Character(
        organization_id=org.id,
        project_id=fog.id,
        name="阿茶",
        role="support",
        gender="female",
        age_group="child",
        style="市井写实",
        description="酒肆跑堂。消息灵通，常给青羽带路，怀里揣着一把纸伞。",
        avatar=PORTRAITS["acha"],
        reference_images=[PORTRAITS["acha"]],
        creation_mode="quick",
        usage_count=2,
    )
    captain = models.Character(
        organization_id=org.id,
        project_id=star.id,
        name="失忆船长",
        role="main",
        gender="male",
        age_group="middle",
        style="科幻写实",
        description="从尘暴带被捞起的男人，只记得一串坐标和一句「别回头」。",
        avatar=PORTRAITS["captain"],
        reference_images=[PORTRAITS["captain"]],
        creation_mode="quick",
    )
    navigator = models.Character(
        organization_id=org.id,
        project_id=star.id,
        name="领航员黎笙",
        role="main",
        gender="female",
        age_group="young",
        style="赛博航海",
        description="星港最年轻的领航员，把船长当成一桩必须完成的航线。",
        avatar=PORTRAITS["navigator"],
        reference_images=[PORTRAITS["navigator"]],
        creation_mode="quick",
    )
    db.add_all([qingyu, chijin, acha, captain, navigator])
    db.flush()

    mountain = models.Scene(
        organization_id=org.id,
        project_id=fog.id,
        name="雾隐书院后山",
        description="晨雾未散的竹林石阶，远处隐约可见剑冢。",
        image=SCENES["mountain"],
        status="in-use",
        gen_method="model",
        model_id="qwen-image-2.0",
        style="水墨",
        camera={"shotType": "wide", "distance": 40, "horizontal": 0, "vertical": 8},
        reference_images=[SCENES["mountain"]],
        creation_mode="quick",
        usage_count=3,
    )
    street = models.Scene(
        organization_id=org.id,
        project_id=fog.id,
        name="夜雨长街",
        description="青石板被雨洗亮，纸灯笼在雾里一串串晃动。",
        image=SCENES["street"],
        status="in-use",
        gen_method="model",
        camera={"shotType": "medium", "distance": 18, "horizontal": -10, "vertical": 0},
        reference_images=[SCENES["street"]],
        creation_mode="quick",
        usage_count=2,
    )
    tavern = models.Scene(
        organization_id=org.id,
        project_id=fog.id,
        name="灯火酒肆",
        description="二楼卡座能看见整条街。阿茶总把热茶先放到靠窗的位置。",
        image=SCENES["tavern"],
        status="draft",
        gen_method="upload",
        reference_images=[SCENES["tavern"]],
        creation_mode="quick",
    )
    harbor = models.Scene(
        organization_id=org.id,
        project_id=star.id,
        name="星港停泊区",
        description="巨大的环形码头，航灯在雾一样的星尘里明灭。",
        image=SCENES["harbor"],
        status="draft",
        gen_method="model",
        reference_images=[SCENES["harbor"]],
        creation_mode="quick",
    )
    db.add_all([mountain, street, tavern, harbor])
    db.flush()

    fan = models.ProjectObject(
        organization_id=org.id,
        project_id=fog.id,
        scene_id=mountain.id,
        name="青羽折扇",
        type="weapon",
        description="扇骨是雾隐竹，展开时能拨开一层薄雾。",
        image=PROPS["fan"],
        status="in-use",
        gen_method="model",
        reference_images=[PROPS["fan"]],
        creation_mode="quick",
    )
    sword = models.ProjectObject(
        organization_id=org.id,
        project_id=fog.id,
        name="赤烬长刀",
        type="weapon",
        description="刀身微红，入夜会发出很淡的热意。",
        image=PROPS["sword"],
        status="in-use",
        gen_method="model",
        reference_images=[PROPS["sword"]],
        creation_mode="quick",
    )
    umbrella = models.ProjectObject(
        organization_id=org.id,
        project_id=fog.id,
        scene_id=street.id,
        name="油纸伞",
        type="prop",
        description="阿茶的随身物，伞面画着一只看不清面目的狐狸。",
        image=PROPS["umbrella"],
        status="draft",
        gen_method="upload",
        reference_images=[PROPS["umbrella"]],
        creation_mode="quick",
    )
    compass = models.ProjectObject(
        organization_id=org.id,
        project_id=star.id,
        name="尘暴罗盘",
        type="prop",
        description="指针不指北，只指向船长忘记的那串坐标。",
        image=PROPS["compass"],
        status="draft",
        gen_method="model",
        reference_images=[PROPS["compass"]],
        creation_mode="quick",
    )
    db.add_all([fan, sword, umbrella, compass])
    db.flush()

    ep1 = models.Episode(
        organization_id=org.id,
        project_id=fog.id,
        name="入学",
        code="EP01",
        description="青羽踏入雾隐书院，在后山第一次看见赤烬。",
        status="completed",
        progress=100,
        duration=12,
        creation_mode="quick",
    )
    ep2 = models.Episode(
        organization_id=org.id,
        project_id=fog.id,
        name="夜雨",
        code="EP02",
        description="长街遇袭。阿茶带路，青羽与赤烬第一次联手。",
        status="in-progress",
        progress=55,
        duration=14,
        creation_mode="quick",
    )
    ep3 = models.Episode(
        organization_id=org.id,
        project_id=fog.id,
        name="试剑",
        code="EP03",
        description="剑冢开封。雾里的残影开始开口说话。",
        status="draft",
        progress=10,
        duration=0,
        creation_mode="quick",
    )
    db.add_all([ep1, ep2, ep3])
    db.flush()
    db.add_all(
        [
            models.EpisodeCharacter(episode_id=ep1.id, character_id=qingyu.id),
            models.EpisodeCharacter(episode_id=ep1.id, character_id=chijin.id),
            models.EpisodeScene(episode_id=ep1.id, scene_id=mountain.id),
            models.EpisodeObject(episode_id=ep1.id, object_id=fan.id),
            models.EpisodeCharacter(episode_id=ep2.id, character_id=qingyu.id),
            models.EpisodeCharacter(episode_id=ep2.id, character_id=chijin.id),
            models.EpisodeCharacter(episode_id=ep2.id, character_id=acha.id),
            models.EpisodeScene(episode_id=ep2.id, scene_id=street.id),
            models.EpisodeScene(episode_id=ep2.id, scene_id=tavern.id),
            models.EpisodeObject(episode_id=ep2.id, object_id=umbrella.id),
            models.EpisodeObject(episode_id=ep2.id, object_id=sword.id),
            models.EpisodeCharacter(episode_id=ep3.id, character_id=qingyu.id),
            models.EpisodeCharacter(episode_id=ep3.id, character_id=chijin.id),
            models.EpisodeScene(episode_id=ep3.id, scene_id=mountain.id),
        ]
    )

    wf_character = models.CanvasWorkflow(
        id="workflow_qingyu_look",
        organization_id=org.id,
        project_id=fog.id,
        name="青羽定妆",
        thumbnail=PORTRAITS["qingyu"],
        source_type="character",
        source_asset_id=qingyu.id,
        status="active",
        created_by=lin.id,
        canvas_data={
            "nodes": [
                {
                    "id": "node_prompt",
                    "type": "text",
                    "position": {"x": 80, "y": 140},
                    "data": {"label": "提示词", "value": "青羽立于雾中，持折扇，水墨少年，电影感"},
                },
                {
                    "id": "node_image",
                    "type": "image",
                    "position": {"x": 420, "y": 80},
                    "data": {"label": "定妆图", "url": PORTRAITS["qingyu"]},
                },
            ],
            "edges": [{"id": "edge_1", "source": "node_prompt", "target": "node_image"}],
            "viewport": {"x": 0, "y": 0, "zoom": 1},
        },
    )
    wf_story = models.CanvasWorkflow(
        id="workflow_ep02_board",
        organization_id=org.id,
        project_id=fog.id,
        name="夜雨分镜",
        thumbnail=SCENES["street"],
        source_type="episode",
        source_asset_id=ep2.id,
        status="draft",
        created_by=chen.id,
        canvas_data={
            "nodes": [
                {
                    "id": "node_ep",
                    "type": "text",
                    "position": {"x": 60, "y": 80},
                    "data": {"label": "本集", "value": "EP02 夜雨：长街遇袭，第一次联手"},
                },
                {
                    "id": "node_street",
                    "type": "image",
                    "position": {"x": 380, "y": 40},
                    "data": {"label": "夜雨长街", "url": SCENES["street"]},
                },
            ],
            "edges": [{"id": "edge_ep", "source": "node_ep", "target": "node_street"}],
            "viewport": {"x": 0, "y": 0, "zoom": 0.9},
        },
    )
    db.add_all([wf_character, wf_story])
    db.flush()
    db.add(
        models.CanvasWorkflowMember(
            workflow_id=wf_character.id, user_id=lin.id, project_id=fog.id, role="editor", assigned_by=admin.id
        )
    )
    db.add(
        models.CanvasWorkflowMember(
            workflow_id=wf_story.id, user_id=chen.id, project_id=fog.id, role="editor", assigned_by=admin.id
        )
    )

    db.add_all(
        [
            models.ProjectAsset(
                organization_id=org.id,
                project_id=fog.id,
                name="青羽定妆",
                source_type="character",
                source_id=str(qingyu.id),
                prompt="青羽立于雾中，持折扇",
                url=PORTRAITS["qingyu"],
                extra_metadata={"status": "approved"},
                created_by=lin.id,
            ),
            models.ProjectAsset(
                organization_id=org.id,
                project_id=fog.id,
                name="夜雨长街",
                source_type="scene",
                source_id=str(street.id),
                prompt="青石板夜雨，纸灯笼",
                url=SCENES["street"],
                extra_metadata={"status": "review"},
                created_by=chen.id,
            ),
            models.ProjectAsset(
                organization_id=org.id,
                project_id=fog.id,
                name="赤烬长刀",
                source_type="project_object",
                source_id=str(sword.id),
                url=PROPS["sword"],
                extra_metadata={"status": "draft"},
                created_by=zhou.id,
            ),
            models.ProjectAsset(
                organization_id=org.id,
                project_id=fog.id,
                name="青羽定妆工作流",
                source_type="workflow",
                source_id=wf_character.id,
                url=PORTRAITS["qingyu"],
                extra_metadata={"status": "approved"},
                created_by=lin.id,
            ),
        ]
    )
