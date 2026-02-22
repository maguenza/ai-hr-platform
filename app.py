import os
import markdown
import sys
import queue
import threading
import uuid
import json
from weasyprint import HTML
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv
from hr_agents import run_hr_pipeline

load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY")

supabase: Client | None = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Global dictionary to hold job status and log queues
ACTIVE_JOBS = {}

class StreamToQueue:
    def __init__(self, q, original_stdout):
        self.q = q
        self.original_stdout = original_stdout

    def write(self, text):
        self.original_stdout.write(text)
        if text.strip():
            self.q.put({"type": "log", "data": text})
            
    def flush(self):
        self.original_stdout.flush()

def background_worker(job_id, url, base_resume_path):
    q = ACTIVE_JOBS[job_id]["queue"]
    original_stdout = sys.stdout
    sys.stdout = StreamToQueue(q, original_stdout)
    
    try:
        pdf_file_path = None
        # Run the crew pipeline and get the generated document path and the json report
        md_file_path, json_report = run_hr_pipeline(job_input=url, is_url=True, resume_path=base_resume_path)
        
        if md_file_path and os.path.exists(md_file_path):
            with open(md_file_path, 'r', encoding='utf-8') as f:
                md_text = f.read()
                
            html_text = markdown.markdown(md_text)
            
            styled_html = f"""
            <html>
                <head>
                    <style>
                        body {{ font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; margin: 40px; color: #333; }}
                        h1 {{ color: #111; margin-bottom: 5px; font-size: 24px; text-transform: uppercase; }}
                        h2 {{ color: #222; margin-top: 15px; margin-bottom: 10px; font-size: 18px; }}
                        h3 {{ color: #444; margin-top: 15px; margin-bottom: 5px; font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 3px;}}
                        p {{ margin-bottom: 10px; }}
                        hr {{ border: 0; border-top: 1px solid #ddd; margin: 15px 0; }}
                        ul {{ padding-left: 20px; }}
                        li {{ margin-bottom: 6px; font-size: 14px; text-align: justify; }}
                    </style>
                </head>
                <body>
                    {html_text}
                </body>
            </html>
            """
            pdf_file_path = md_file_path.replace('.md', '.pdf')
            HTML(string=styled_html).write_pdf(pdf_file_path)
        
        # Parse the JSON report string to dictionary or just pass it through
        # CrewAI output might have ```json block around it
        report_data = {}
        if json_report:
            cleaned_report = json_report.replace("```json", "").replace("```", "").strip()
            try:
                report_data = json.loads(cleaned_report)
            except Exception as e:
                report_data = {"error": "Failed to parse report", "raw": cleaned_report}

        if pdf_file_path:
            filename = os.path.basename(pdf_file_path)
            # Make the file path accessible via an endpoint
            ACTIVE_JOBS[job_id]["pdf_path"] = pdf_file_path
            q.put({"type": "complete", "report": report_data, "filename": filename})
        else:
            q.put({"type": "error", "data": "Pipeline failed to generate resume"})
            
    except Exception as e:
        q.put({"type": "error", "data": str(e)})
    finally:
        sys.stdout = original_stdout


@app.route('/api/start-optimization', methods=['POST'])
def start_optimization():
    # Attempt auth if Supabase is strictly configured
    if supabase:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"error": "Unauthorized"}), 401
        token = auth_header.split(" ")[1]
        try:
            user_resp = supabase.auth.get_user(token)
            if not user_resp or not user_resp.user:
                return jsonify({"error": "Unauthorized Invalid Token"}), 401
        except Exception as e:
            return jsonify({"error": f"Unauthorized Exception: {str(e)}"}), 401

    # Now get url and resume file via Form Data
    url = request.form.get('url')
    resume_file = request.files.get('resume')
    
    if not url or not resume_file:
        return jsonify({"error": "URL and base resume PDF are required"}), 400
        
    job_id = str(uuid.uuid4())
    queue_obj = queue.Queue()
    ACTIVE_JOBS[job_id] = {"queue": queue_obj}
    
    # Save uploaded file
    upload_dir = os.path.join(os.getcwd(), 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    base_resume_path = os.path.join(upload_dir, f"{job_id}_base.pdf")
    resume_file.save(base_resume_path)
    
    thread = threading.Thread(target=background_worker, args=(job_id, url, base_resume_path))
    thread.start()
    
    return jsonify({"job_id": job_id})

@app.route('/api/stream-job/<job_id>', methods=['GET'])
def stream_job(job_id):
    if job_id not in ACTIVE_JOBS:
        return jsonify({"error": "Job not found"}), 404
        
    def generate():
        q = ACTIVE_JOBS[job_id]["queue"]
        while True:
            try:
                msg = q.get(timeout=30)
                # yield SSE format
                yield f"data: {json.dumps(msg)}\n\n"
                if msg["type"] in ["complete", "error"]:
                    break
            except queue.Empty:
                # Keep-alive
                yield ": keep-alive\n\n"
                
    return Response(generate(), mimetype='text/event-stream')
    
@app.route('/api/download-pdf/<job_id>', methods=['GET'])
def download_pdf(job_id):
    if job_id not in ACTIVE_JOBS or not ACTIVE_JOBS[job_id]["pdf_path"]:
        return jsonify({"error": "Not found"}), 404
        
    pdf_path = ACTIVE_JOBS[job_id]["pdf_path"]
    return send_file(
        pdf_path,
        as_attachment=True,
        download_name=os.path.basename(pdf_path),
        mimetype='application/pdf'
    )

if __name__ == '__main__':
    app.run(port=5000, debug=True)
