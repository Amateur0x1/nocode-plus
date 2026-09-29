import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.app_versions import App_versionsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/app_versions", tags=["app_versions"])


# ---------- Pydantic Schemas ----------
class App_versionsData(BaseModel):
    """Entity data schema (for create/update)"""
    project_id: int
    version_number: int
    html_code: str
    prompt: str = None


class App_versionsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    project_id: Optional[int] = None
    version_number: Optional[int] = None
    html_code: Optional[str] = None
    prompt: Optional[str] = None


class App_versionsResponse(BaseModel):
    """Entity response schema"""
    id: int
    project_id: int
    version_number: int
    html_code: str
    prompt: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class App_versionsListResponse(BaseModel):
    """List response schema"""
    items: List[App_versionsResponse]
    total: int
    skip: int
    limit: int


class App_versionsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[App_versionsData]


class App_versionsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: App_versionsUpdateData


class App_versionsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[App_versionsBatchUpdateItem]


class App_versionsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=App_versionsListResponse)
async def query_app_versionss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query app_versionss with filtering, sorting, and pagination"""
    logger.debug(f"Querying app_versionss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = App_versionsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} app_versionss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid app_versions query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying app_versionss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=App_versionsListResponse)
async def query_app_versionss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query app_versionss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying app_versionss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = App_versionsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} app_versionss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid app_versions query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying app_versionss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=App_versionsResponse)
async def get_app_versions(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single app_versions by ID"""
    logger.debug(f"Fetching app_versions with id: {id}, fields={fields}")
    
    service = App_versionsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"App_versions with id {id} not found")
            raise HTTPException(status_code=404, detail="App_versions not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching app_versions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=App_versionsResponse, status_code=201)
async def create_app_versions(
    data: App_versionsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new app_versions"""
    logger.debug(f"Creating new app_versions with data: {data}")
    
    service = App_versionsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create app_versions")
        
        logger.info(f"App_versions created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating app_versions: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating app_versions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[App_versionsResponse], status_code=201)
async def create_app_versionss_batch(
    request: App_versionsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple app_versionss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} app_versionss")
    
    service = App_versionsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} app_versionss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[App_versionsResponse])
async def update_app_versionss_batch(
    request: App_versionsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple app_versionss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} app_versionss")
    
    service = App_versionsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} app_versionss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=App_versionsResponse)
async def update_app_versions(
    id: int,
    data: App_versionsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing app_versions"""
    logger.debug(f"Updating app_versions {id} with data: {data}")

    service = App_versionsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"App_versions with id {id} not found for update")
            raise HTTPException(status_code=404, detail="App_versions not found")
        
        logger.info(f"App_versions {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating app_versions {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating app_versions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_app_versionss_batch(
    request: App_versionsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple app_versionss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} app_versionss")
    
    service = App_versionsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} app_versionss successfully")
        return {"message": f"Successfully deleted {deleted_count} app_versionss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_app_versions(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single app_versions by ID"""
    logger.debug(f"Deleting app_versions with id: {id}")
    
    service = App_versionsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"App_versions with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="App_versions not found")
        
        logger.info(f"App_versions {id} deleted successfully")
        return {"message": "App_versions deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting app_versions {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")