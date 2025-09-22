"""
main.py

Proxies HTTP requests to Google Cloud Pub/Sub, validating a bearer token.

Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
Developed with assistance from ChatGPT 4o (2025) and Google Gemini 2.5 Pro (2025).
Apache 2.0 Licensed as described in the file LICENSE
"""
import os
import json
from google.cloud import pubsub_v1
import functions_framework

# Initialize the publisher client once globally. It's safe and efficient.
publisher = pubsub_v1.PublisherClient()


@functions_framework.http
def proxy_to_pubsub(request):
    """
    HTTP Cloud Function to receive a JSON payload, validate a bearer token,
    and publish the payload to a Pub/Sub topic.
    """
    # --- Read environment variables inside the function ---
    project_id = os.environ.get("GCP_PROJECT")
    topic_id = os.environ.get("TOPIC_ID")
    secret_bearer_token = os.environ.get("SECRET_BEARER_TOKEN")

    # --- Server Configuration Check ---
    if not all([project_id, topic_id, secret_bearer_token]):
        print("ERROR: Service is not configured correctly. Check environment variables.")
        return ("Internal Server Error: Service is not configured.", 500)

    # --- Authentication Check ---
    auth_header = request.headers.get("Authorization")
    expected_token = f"Bearer {secret_bearer_token}"

    if not auth_header or auth_header != expected_token:
        print(f"WARN: Unauthorized access attempt. Provided token: {auth_header}")
        return ("Unauthorized: Invalid or missing bearer token.", 401)

    # --- Content Type Check ---
    if request.content_type != 'application/json':
        print(f"WARN: Invalid content type: {request.content_type}")
        return ("Bad Request: Content-Type must be application/json.", 400)

    # --- Log Raw Request Body for Debugging ---
    try:
        raw_body = request.get_data(as_text=True)
        print(f"DEBUG: Raw request body (length {len(raw_body)}): {raw_body}")
    except Exception as e:
        print(f"ERROR: Could not read raw request body: {e}")
        return ("Bad Request: Could not read request body.", 400)

    # --- JSON Payload Validation ---
    try:
        data = request.get_json(silent=True)
        print(f"DEBUG: Parsed JSON type: {type(data)}")

        if data is None:
            print("ERROR: JSON parsing returned None")
            return ("Bad Request: Invalid JSON format.", 400)

        # Log the structure for debugging
        if isinstance(data, list):
            print(f"DEBUG: Received array with {len(data)} items")
            if len(data) > 0:
                print(f"DEBUG: First item keys: {list(data[0].keys()) if isinstance(data[0], dict) else 'Not a dict'}")
        elif isinstance(data, dict):
            print(f"DEBUG: Received single object with keys: {list(data.keys())}")
        else:
            print(f"DEBUG: Received unexpected data type: {type(data)}")

        # Accept both arrays and single objects (convert single to array)
        if isinstance(data, dict):
            print("INFO: Converting single object to array")
            data = [data]
        elif not isinstance(data, list):
            print(f"ERROR: JSON body must be a list or object, got {type(data)}")
            return ("Bad Request: JSON body must be a list of sensor readings or a single object.", 400)

    except Exception as e:
        print(f"ERROR: Could not parse JSON. Error: {e}")
        return ("Bad Request: Invalid JSON format.", 400)

    # --- Additional Validation for Arrays ---
    if len(data) == 0:
        print("WARN: Received empty array")
        return ("Bad Request: Empty array not allowed.", 400)

    # --- Publish to Pub/Sub ---
    try:
        topic_path = publisher.topic_path(project_id, topic_id)
        message_data = json.dumps(data).encode("utf-8")
        print(f"DEBUG: Publishing message of {len(message_data)} bytes to {topic_path}")

        future = publisher.publish(topic_path, data=message_data)
        message_id = future.result(timeout=10)

        print(f"INFO: Successfully published message {message_id} to {topic_path}")
        return (f"Message received and published with ID: {message_id}", 200)

    except Exception as e:
        print(f"ERROR: Failed to publish to Pub/Sub. Error: {e}")
        return ("Internal Server Error: Could not publish message.", 500)