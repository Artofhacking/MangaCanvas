from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .util import now


class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(64))
    can_create_organization: Mapped[bool] = mapped_column(Boolean, default=False)
    can_create_project: Mapped[bool] = mapped_column(Boolean, default=True)
    can_manage_project_members: Mapped[bool] = mapped_column(Boolean, default=False)
    list_all_projects: Mapped[bool] = mapped_column(Boolean, default=False)
    list_organization_projects: Mapped[bool] = mapped_column(Boolean, default=False)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), default=3)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    email: Mapped[str] = mapped_column(String(128), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(256), nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(512), nullable=True)
    credits: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    role: Mapped[Role] = relationship()


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(128))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class ProjectMember(Base):
    __tablename__ = "project_members"
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    organization_id: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(16), default="viewer")
    assigned_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Character(Base):
    __tablename__ = "characters"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(Integer)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(16), default="main")
    gender: Mapped[str | None] = mapped_column(String(16), nullable=True)
    age_group: Mapped[str | None] = mapped_column(String(16), nullable=True)
    style: Mapped[str | None] = mapped_column(String(64), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar: Mapped[str | None] = mapped_column(String(512), nullable=True)
    reference_images: Mapped[list] = mapped_column(JSON, default=list)
    model_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    seed: Mapped[str | None] = mapped_column(String(64), nullable=True)
    creation_mode: Mapped[str] = mapped_column(String(16), default="quick")
    source_workflow_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_node_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Scene(Base):
    __tablename__ = "scenes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(Integer)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    gen_method: Mapped[str | None] = mapped_column(String(16), nullable=True)
    model_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    style: Mapped[str | None] = mapped_column(String(64), nullable=True)
    camera: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reference_images: Mapped[list] = mapped_column(JSON, default=list)
    seed: Mapped[str | None] = mapped_column(String(64), nullable=True)
    creation_mode: Mapped[str] = mapped_column(String(16), default="quick")
    source_workflow_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_node_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class ProjectObject(Base):
    __tablename__ = "project_objects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(Integer)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    scene_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    name: Mapped[str] = mapped_column(String(128))
    type: Mapped[str] = mapped_column(String(32), default="prop")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    gen_method: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reference_images: Mapped[list] = mapped_column(JSON, default=list)
    creation_mode: Mapped[str] = mapped_column(String(16), default="quick")
    source_workflow_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_node_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class Episode(Base):
    __tablename__ = "episodes"
    __table_args__ = (UniqueConstraint("project_id", "code", name="uq_episode_code"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(Integer)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(128))
    code: Mapped[str] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    duration: Mapped[int] = mapped_column(Integer, default=0)
    creation_mode: Mapped[str] = mapped_column(String(16), default="quick")
    source_workflow_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_node_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class EpisodeCharacter(Base):
    __tablename__ = "episode_characters"
    episode_id: Mapped[int] = mapped_column(ForeignKey("episodes.id"), primary_key=True)
    character_id: Mapped[int] = mapped_column(ForeignKey("characters.id"), primary_key=True)


class EpisodeScene(Base):
    __tablename__ = "episode_scenes"
    episode_id: Mapped[int] = mapped_column(ForeignKey("episodes.id"), primary_key=True)
    scene_id: Mapped[int] = mapped_column(ForeignKey("scenes.id"), primary_key=True)


class EpisodeObject(Base):
    __tablename__ = "episode_objects"
    episode_id: Mapped[int] = mapped_column(ForeignKey("episodes.id"), primary_key=True)
    object_id: Mapped[int] = mapped_column(ForeignKey("project_objects.id"), primary_key=True)


class CanvasWorkflow(Base):
    __tablename__ = "canvas_workflows"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    organization_id: Mapped[int] = mapped_column(Integer)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(128))
    thumbnail: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_type: Mapped[str] = mapped_column(String(32), default="blank")
    source_asset_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    canvas_data: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class CanvasWorkflowMember(Base):
    __tablename__ = "canvas_workflow_members"
    workflow_id: Mapped[str] = mapped_column(ForeignKey("canvas_workflows.id"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    project_id: Mapped[int] = mapped_column(Integer)
    role: Mapped[str] = mapped_column(String(16), default="viewer")
    assigned_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ProjectAsset(Base):
    __tablename__ = "project_assets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int] = mapped_column(Integer)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_type: Mapped[str] = mapped_column(String(32))
    source_id: Mapped[str] = mapped_column(String(64))
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    file_key: Mapped[str] = mapped_column(String(64), unique=True)
    url: Mapped[str] = mapped_column(String(512))
    directory: Mapped[str] = mapped_column(String(32))
    filename: Mapped[str] = mapped_column(String(256))
    content_type: Mapped[str] = mapped_column(String(128))
    size: Mapped[int] = mapped_column(Integer, default=0)
    related_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    put_token: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class BillingLedger(Base):
    __tablename__ = "billing_ledger"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    organization_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    project_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    user_id: Mapped[int] = mapped_column(Integer)
    entry_type: Mapped[str] = mapped_column(String(16))
    amount: Mapped[int] = mapped_column(Integer)
    balance_after: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(String(256), nullable=True)
    reference_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class BillingEnterpriseQuota(Base):
    __tablename__ = "billing_enterprise_quota"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    quota_limit: Mapped[int] = mapped_column(BigInteger, default=1_000_000)
    quota_consumed: Mapped[int] = mapped_column(BigInteger, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class BillingOrganizationQuota(Base):
    __tablename__ = "billing_organization_quotas"
    organization_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quota_percent: Mapped[float] = mapped_column(Float, default=100.0)
    quota_limit: Mapped[int] = mapped_column(BigInteger, default=1_000_000)
    quota_consumed: Mapped[int] = mapped_column(BigInteger, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class BillingProjectQuota(Base):
    __tablename__ = "billing_project_quotas"
    project_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quota_percent: Mapped[float] = mapped_column(Float, default=100.0)
    quota_limit: Mapped[int] = mapped_column(BigInteger, default=100_000)
    quota_consumed: Mapped[int] = mapped_column(BigInteger, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class BillingUserProjectQuota(Base):
    __tablename__ = "billing_user_project_quotas"
    project_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quota_percent: Mapped[float] = mapped_column(Float, default=100.0)
    quota_limit: Mapped[int] = mapped_column(BigInteger, default=10_000)
    quota_consumed: Mapped[int] = mapped_column(BigInteger, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
