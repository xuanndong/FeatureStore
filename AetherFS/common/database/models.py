# Standar Libraries
from datetime import datetime, timezone
from uuid import UUID, uuid4
from enum import Enum

# Third-party Libraries
from sqlmodel import SQLModel, Field, Relationship, Column, String,Text, Float
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB


class FeatureViewMember(SQLModel, table=True):
    """
    Feature View Member Table
    """
    __tablename__ = "feature_view_members"

    view_id: UUID = Field(foreign_key="feature_views.id", primary_key=True, ondelete="CASCADE")
    feature_id: UUID = Field(foreign_key="features.id", primary_key=True, ondelete="CASCADE", index=True)


def currentTimeUTC():
    return datetime.now(timezone.utc).timestamp()

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


class SourceType(str, Enum):
    BATCH = "BATCH"
    STREAM = "STREAM"


class SourceFormat(str, Enum):
    CSV = "CSV"
    PARQUET = "PARQUET"
    AVRO = "AVRO"
    JSON = "JSON"


class DataSource(SQLModel, table=True):
    """
    Data Source Table
    """
    __tablename__ = "data_sources"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(100), nullable=False, index=True))
    source_type: SourceType = Field(sa_column=Column(String(20))) # BATCH, STREAM
    source_format: SourceFormat = Field(sa_column=Column(String(20))) # CSV, PARQUET, AVRO, JSON
    location_uri: str = Field(sa_column=Column(String(255), nullable=False))
    timestamp_field: str = Field(sa_column=Column(String(50), nullable=False))
    updated_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float, onupdate=currentTimeUTC))
    created_at: float = Field(default_factory=currentTimeUTC, sa_column=Column(Float))

    # Relationships
    feature_groups: list["FeatureGroup"] = Relationship(back_populates="source")


class TransformationType(str, Enum):
    SQL = "SQL"
    PYTHON_UDF = "PYTHON_UDF"
    AGGREGATION = "AGGREGATION"


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


class FeatureGroupStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    DEPRECATED = "DEPRECATED"


class FeatureGroup(SQLModel, table=True):
    """
    Feature Group Table
    """
    __tablename__ = "feature_groups"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    name: str = Field(sa_column=Column(String(100), unique=True, nullable=False))
    status: FeatureGroupStatus = Field(sa_column=Column(String(20), default="ACTIVE")) # ACTIVE, INACTIVE, DEPRECATED
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

    __table_args__ = (
        UniqueConstraint("group_id", "name", "version", name="unique_feature_version"),
    )

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    group_id: UUID = Field(foreign_key="feature_groups.id", ondelete="CASCADE", index=True)
    name: str = Field(sa_column=Column(String(100), nullable=False))
    data_type: str = Field(sa_column=Column(String(50), nullable=False))
    version: int = Field(default=1)
    is_nullable: bool = Field(default=True)
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
