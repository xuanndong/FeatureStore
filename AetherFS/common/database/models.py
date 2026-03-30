# Standar Libraries
from datetime import datetime, timezone
from uuid import UUID, uuid4

# Third party Libraries
from sqlmodel import SQLModel, Field, Relationship, Column, String,Text, Float, Boolean
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

# User define Libraries
from common.constants import SourceFormat, SourceType, TransformationType, FeatureGroupStatus, Materialization


def currentTimeUTC():
    return datetime.now(timezone.utc).timestamp()


class FeatureViewMember(SQLModel, table=True):
    """
    Feature View Member Table
    """
    __tablename__ = "feature_view_members"

    view_id: UUID = Field(foreign_key="feature_views.id", primary_key=True, ondelete="CASCADE")
    feature_id: UUID = Field(foreign_key="features.id", primary_key=True, ondelete="CASCADE", index=True)


class Entity(SQLModel, table=True):
    """
    Entity Table
    """
    __tablename__ = "entities"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))
    join_key: str = Field(sa_column=Column(String(50), nullable=False))
    description: str | None = Field(default=None, sa_column=Column(Text))
    updated_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float, onupdate=currentTimeUTC))
    created_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float))

    # Relationships
    feature_groups: list["FeatureGroup"] = Relationship(back_populates="entity")


class DataSource(SQLModel, table=True):
    """
    Data Source Table
    """
    __tablename__ = "data_sources"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(100), nullable=False, index=True))
    source_type: SourceType = Field(sa_column=Column(String(20))) # BATCH, STREAM
    source_format: SourceFormat = Field(sa_column=Column(String(20))) # CSV, PARQUET, AVRO, JSON
    connection_options: dict | None = Field(default=None, sa_column=Column(JSONB))
    location_uri: str = Field(sa_column=Column(String(255), nullable=False))

    updated_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float, onupdate=currentTimeUTC))
    created_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float))

    # Relationships
    feature_groups: list["FeatureGroup"] = Relationship(back_populates="source")


class Transformation(SQLModel, table=True):
    """
    Transformation Feature Table
    """
    __tablename__ = "transformations"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))
    t_type: TransformationType = Field(sa_column=Column(String(20))) # SQL, PYTHON_UDF, AGGREGATION
    definition: str = Field(sa_column=Column(Text, nullable=False))
    window_config: dict | None = Field(default=None, sa_column=Column(JSONB))
    updated_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float, onupdate=currentTimeUTC))
    created_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float))

    # Relationships
    feature_groups: list["FeatureGroup"] = Relationship(back_populates="transformation")


class FeatureGroup(SQLModel, table=True):
    """
    Feature Group Table
    """
    __tablename__ = "feature_groups"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))
    status: FeatureGroupStatus = Field(sa_column=Column(String(20), default=FeatureGroupStatus.ACTIVE)) # ACTIVE, INACTIVE, DEPRECATED

    offline_uri: str | None = Field(default=None, sa_column=Column(String(255)))
    last_run_status: Materialization = Field(default=Materialization.PENDING, sa_column=Column(String(20)))
    last_run_at: float = Field(default=0.0, sa_column=Column(Float))

    is_scheduled: bool = Field(default=False, sa_column=Column(Boolean, default=False))
    cron_expression: str | None = Field(default=None, sa_column=Column(String(100)))
    next_run_at: float | None = Field(default=None, sa_column=Column(Float))

    entity_id: UUID = Field(foreign_key="entities.id", ondelete="CASCADE", index=True)
    source_id: UUID = Field(foreign_key="data_sources.id", ondelete="CASCADE", index=True)
    transformation_id: UUID | None = Field(foreign_key="transformations.id", default=None, index=True)

    updated_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float, onupdate=currentTimeUTC))
    created_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float))

    # Relationships
    entity: Entity = Relationship(back_populates="feature_groups")
    source: DataSource = Relationship(back_populates="feature_groups")
    transformation: Transformation | None = Relationship(back_populates="feature_groups")
    features: list["Feature"] = Relationship(back_populates="group")


class Feature(SQLModel, table=True):
    """
    Feature Table
    """
    __tablename__ = "features"

    # Access restriction: Duplicate feature names are not allowed within the same FeatureGroup
    __table_args__ = ( UniqueConstraint("group_id", "name", name="unique_feature_in_group"), )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    group_id: UUID = Field(foreign_key="feature_groups.id", ondelete="CASCADE", index=True)
    name: str = Field(sa_column=Column(String(100), nullable=False))
    data_type: str = Field(sa_column=Column(String(50), nullable=False))

    description: str | None = Field(default=None, sa_column=Column(Text))

    # Relationships
    group: FeatureGroup = Relationship(back_populates="features")
    views: list["FeatureView"] = Relationship(back_populates="features", link_model=FeatureViewMember)


class FeatureView(SQLModel, table=True):
    """
    Feature View Table
    """
    __tablename__ = "feature_views"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))
    ttl_seconds: int = Field(default=3600)
    created_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float))

    # Relationships
    features: list[Feature] = Relationship(back_populates="views", link_model=FeatureViewMember)
