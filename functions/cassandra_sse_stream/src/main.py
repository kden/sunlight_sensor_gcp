"""
main.py

Cloud Function to stream sensor reading updates via Server-Sent Events (SSE).

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from Claude Sonnet 4.5 (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import os
import time
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import requests
import functions_framework
from flask import Response, request

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
POLL_INTERVAL_SECONDS = 60
CONNECTION_TIMEOUT_SECONDS = 300  # 5 minutes
CASSANDRA_FUNCTION_URL = None  # Will be set from environment


def get_cassandra_function_url() -> str:
    """Get the Cassandra latest readings function URL from environment."""
    global CASSANDRA_FUNCTION_URL
    
    if CASSANDRA_FUNCTION_URL is None:
        project_id = os.environ.get('GCP_PROJECT_ID')
        region = os.environ.get('GCP_REGION', 'us-central1')
        
        if not project_id:
            raise ValueError("GCP_PROJECT_ID environment variable not set")
        
        CASSANDRA_FUNCTION_URL = (
            f"https://{region}-{project_id}.cloudfunctions.net/cassandra-latest-readings"
        )
    
    return CASSANDRA_FUNCTION_URL


def fetch_latest_readings(sensor_set_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch latest readings from the cassandra-latest-readings Cloud Function.
    
    Args:
        sensor_set_id: The sensor set ID to filter by
        
    Returns:
        Dictionary mapping sensor_id to reading data, or None on error
    """
    try:
        url = get_cassandra_function_url()
        response = requests.get(
            url,
            params={'sensor_set_id': sensor_set_id},
            timeout=10
        )
        
        if response.status_code != 200:
            logger.error(f"Cassandra function returned status {response.status_code}")
            return None
        
        readings = response.json()
        
        # Convert list to dict keyed by sensor_id for easier comparison
        readings_dict = {
            reading['sensor_id']: reading 
            for reading in readings
        }
        
        return readings_dict
        
    except Exception as e:
        logger.error(f"Error fetching latest readings: {e}")
        return None


def has_data_changed(old_data: Optional[Dict], new_data: Optional[Dict]) -> bool:
    """
    Check if sensor data has changed by comparing last_seen timestamps.
    
    Args:
        old_data: Previous readings dictionary
        new_data: New readings dictionary
        
    Returns:
        True if data has changed, False otherwise
    """
    if old_data is None or new_data is None:
        return True
    
    if set(old_data.keys()) != set(new_data.keys()):
        return True
    
    for sensor_id in new_data:
        old_last_seen = old_data.get(sensor_id, {}).get('last_seen')
        new_last_seen = new_data.get(sensor_id, {}).get('last_seen')
        
        if old_last_seen != new_last_seen:
            return True
    
    return False


def format_sse_message(data: Any, event: str = "message") -> str:
    """
    Format data as Server-Sent Event message.
    
    Args:
        data: Data to send (will be JSON-encoded)
        event: Event type name
        
    Returns:
        Formatted SSE message string
    """
    message = f"event: {event}\n"
    message += f"data: {json.dumps(data)}\n\n"
    return message


def generate_sse_stream(sensor_set_id: str):
    """
    Generator function that yields SSE-formatted sensor updates.
    
    Args:
        sensor_set_id: The sensor set ID to monitor
        
    Yields:
        SSE-formatted message strings
    """
    start_time = time.time()
    last_data = None
    
    # Send initial connection success message
    yield format_sse_message({
        'type': 'connected',
        'sensor_set_id': sensor_set_id,
        'timestamp': datetime.utcnow().isoformat()
    }, event='status')
    
    while True:
        # Check connection timeout
        if time.time() - start_time > CONNECTION_TIMEOUT_SECONDS:
            logger.info(f"Connection timeout reached for sensor_set_id={sensor_set_id}")
            yield format_sse_message({
                'type': 'timeout',
                'message': 'Connection timeout - please reconnect'
            }, event='status')
            break
        
        try:
            # Fetch latest readings
            current_data = fetch_latest_readings(sensor_set_id)
            
            if current_data is None:
                # Send error event but keep connection alive
                yield format_sse_message({
                    'type': 'error',
                    'message': 'Failed to fetch readings'
                }, event='error')
                
            elif has_data_changed(last_data, current_data):
                # Convert dict back to list for client
                readings_list = list(current_data.values())
                
                # Send update event
                yield format_sse_message({
                    'type': 'update',
                    'readings': readings_list,
                    'timestamp': datetime.utcnow().isoformat()
                }, event='update')
                
                last_data = current_data
                logger.info(f"Sent update for sensor_set_id={sensor_set_id}, {len(readings_list)} sensors")
            
            # Send periodic heartbeat
            else:
                yield format_sse_message({
                    'type': 'heartbeat',
                    'timestamp': datetime.utcnow().isoformat()
                }, event='heartbeat')
            
        except Exception as e:
            logger.error(f"Error in SSE stream: {e}")
            yield format_sse_message({
                'type': 'error',
                'message': str(e)
            }, event='error')
        
        # Wait before next poll
        time.sleep(POLL_INTERVAL_SECONDS)


@functions_framework.http
def stream_sensor_updates(request):
    """
    HTTP Cloud Function that streams sensor reading updates via SSE.
    
    Query parameters:
        sensor_set_id: Required - the sensor set to monitor
    """
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    # Get sensor_set_id from query parameters
    sensor_set_id = request.args.get('sensor_set_id')
    
    if not sensor_set_id:
        return (
            json.dumps({'error': 'sensor_set_id parameter is required'}),
            400,
            {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        )
    
    logger.info(f"Starting SSE stream for sensor_set_id={sensor_set_id}")
    
    # Return SSE response
    return Response(
        generate_sse_stream(sensor_set_id),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Access-Control-Allow-Origin': '*',
            'Connection': 'keep-alive'
        }
    )