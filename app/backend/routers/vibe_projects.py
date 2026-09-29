import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.vibe_projects import Vibe_projectsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/vibe_projects", tags=["vibe_projects"])


# ---------- Pydantic Schemas ----------
class Vibe_projectsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    description: str = None


class Vibe_projectsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    description: Optional[str] = None


class Vibe_projectsResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Vibe_projectsListResponse(BaseModel):
    """List response schema"""
    items: List[Vibe_projectsResponse]
    total: int
    skip: int
    limit: int


class Vibe_projectsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Vibe_projectsData]


class Vibe_projectsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Vibe_projectsUpdateData


class Vibe_projectsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Vibe_projectsBatchUpdateItem]


class Vibe_projectsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Vibe_projectsListResponse)
async def query_vibe_projectss(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query vibe_projectss with filtering, sorting, and pagination"""
    logger.debug(f"Querying vibe_projectss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Vibe_projectsService(db)
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
        logger.debug(f"Found {result['total']} vibe_projectss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid vibe_projects query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying vibe_projectss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Vibe_projectsListResponse)
async def query_vibe_projectss_all(
    query: str = Query(None, description='Query conditions as JSON, e.g. {"id":2} or {"id":{"$gte":2}}'),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query vibe_projectss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying vibe_projectss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Vibe_projectsService(db)
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
        logger.debug(f"Found {result['total']} vibe_projectss")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Invalid vibe_projects query: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error querying vibe_projectss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Vibe_projectsResponse)
async def get_vibe_projects(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single vibe_projects by ID"""
    logger.debug(f"Fetching vibe_projects with id: {id}, fields={fields}")
    
    service = Vibe_projectsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Vibe_projects with id {id} not found")
            raise HTTPException(status_code=404, detail="Vibe_projects not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching vibe_projects {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Vibe_projectsResponse, status_code=201)
async def create_vibe_projects(
    data: Vibe_projectsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new vibe_projects"""
    logger.debug(f"Creating new vibe_projects with data: {data}")
    
    service = Vibe_projectsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create vibe_projects")
        
        logger.info(f"Vibe_projects created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating vibe_projects: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating vibe_projects: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Vibe_projectsResponse], status_code=201)
async def create_vibe_projectss_batch(
    request: Vibe_projectsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple vibe_projectss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} vibe_projectss")
    
    service = Vibe_projectsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} vibe_projectss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Vibe_projectsResponse])
async def update_vibe_projectss_batch(
    request: Vibe_projectsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple vibe_projectss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} vibe_projectss")
    
    service = Vibe_projectsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} vibe_projectss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Vibe_projectsResponse)
async def update_vibe_projects(
    id: int,
    data: Vibe_projectsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing vibe_projects"""
    logger.debug(f"Updating vibe_projects {id} with data: {data}")

    service = Vibe_projectsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Vibe_projects with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Vibe_projects not found")
        
        logger.info(f"Vibe_projects {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating vibe_projects {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating vibe_projects {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_vibe_projectss_batch(
    request: Vibe_projectsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple vibe_projectss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} vibe_projectss")
    
    service = Vibe_projectsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} vibe_projectss successfully")
        return {"message": f"Successfully deleted {deleted_count} vibe_projectss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_vibe_projects(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single vibe_projects by ID"""
    logger.debug(f"Deleting vibe_projects with id: {id}")
    
    service = Vibe_projectsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Vibe_projects with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Vibe_projects not found")
        
        logger.info(f"Vibe_projects {id} deleted successfully")
        return {"message": "Vibe_projects deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting vibe_projects {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")