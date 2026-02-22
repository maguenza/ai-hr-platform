import os
from crewai import Agent, Task, Crew, Process
from langchain_google_genai import ChatGoogleGenerativeAI
from tools import ReadJDFromURLTool, ReadPDFResumeTool, SaveUpdatedResumeTool
import argparse
from dotenv import load_dotenv
import glob

load_dotenv()
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-pro",
    verbose=True,
    temperature=0.5,
)
# -----------------
# 1. Define Agents
# -----------------

job_analyst_agent = Agent(
    role='Expert Job Description Analyst',
    goal='Analyze job descriptions from URLs or text and extract key skills, requirements, and responsibilities.',
    backstory='You are an expert technical recruiter who has read thousands of job descriptions. You are exceptional at finding the truly important skills and requirements buried in corporate jargon.',
    verbose=True,
    allow_delegation=False,
    tools=[ReadJDFromURLTool()],
    llm=llm
)

keyword_strategist_agent = Agent(
    role='ATS Keyword Strategist',
    goal='Identify missing high-value keywords from the job description that should be included in the candidate\'s resume to pass Applicant Tracking Systems (ATS).',
    backstory='You are a master of Search Engine Optimization and ATS algorithms. You know exactly what words recruiters filter for, and you help candidates tailor their resume to match without lying.',
    verbose=True,
    allow_delegation=False,
    llm=llm
)

resume_updater_agent = Agent(
    role='Resume Editor & Updater',
    goal='Update the candidate\'s current resume with the recommended keywords, maintaining the original format, tone, and absolute truthfulness of their experience.',
    backstory='You are a professional resume writer for Kim Aguenza. You know how to seamlessly weave in new keywords into existing bullet points so it sounds natural and highlights Kim\'s real skills. You never fabricate experience.',
    verbose=True,
    allow_delegation=False,
    tools=[ReadPDFResumeTool()],
    llm=llm
)

resume_reviewer_agent = Agent(
    role='Senior Resume Reviewer & Security Specialist',
    goal='Review the newly updated resume against the job description to score its fitness (1-100), and perform a security check to ensure no inappropriate PII (Personally Identifiable Information) or formatting issues exist.',
    backstory='You are the final gatekeeper. A strict, meticulous reviewer who scores resumes on a rigorous rubric. You also have a background in cybersecurity and ensure candidates aren\'t leaking sensitive info.',
    verbose=True,
    allow_delegation=False,
    llm=llm
)

file_manager_agent = Agent(
    role='File Operations Manager',
    goal='Store the finalized, scored, and updated resume in the designated "new_resumes" folder with a clear, descriptive filename.',
    backstory='You are a highly organized digital librarian. Your only job is to ensure documents are safely stored in their correct directories.',
    verbose=True,
    allow_delegation=False,
    tools=[SaveUpdatedResumeTool()],
    llm=llm
)

evaluator_agent = Agent(
    role='Objective Match Evaluator',
    goal='Format the final evaluation into a strict JSON structure containing the match score, chosen keywords, and missing keywords.',
    backstory='You are a rigorous data analyst. You take the final resume and the original job description, evaluate the match, and output ONLY valid JSON without any markdown code blocks.',
    verbose=True,
    allow_delegation=False,
    llm=llm
)

# -----------------
# 2. Setup Crew flow
# -----------------

def run_hr_pipeline(job_input: str, is_url: bool, resume_path: str):
    """
    Executes the multi-agent pipeline to update Kim's resume based on a job posting.
    """
    if not os.path.exists(resume_path):
        print(f"Error: Original resume not found at {resume_path}")
        return

    # Task 1: Job Analysis
    input_desc = f"from the URL: {job_input}" if is_url else f"from the following text:\n\n{job_input}"
    
    task1_analyze_jd = Task(
        description=f'Crawl/Read the job description {input_desc}. Extract a comprehensive list of required skills, preferred qualifications, and core responsibilities.',
        expected_output='A clean markdown list of technical skills, soft skills, and core responsibilities required for the role.',
        agent=job_analyst_agent
    )

    # Task 2: Keyword Strategy
    task2_find_keywords = Task(
        description='Using the job analysis provided, identify specific keywords and phrases that an ATS system would likely scan for. Rank them by importance.',
        expected_output='A prioritized list of high-value keywords to inject into the candidate\'s resume.',
        agent=keyword_strategist_agent
    )

    # Task 3: Resume Update
    task3_update_resume = Task(
        description=f'Read Kim Aguenza\'s current resume from {resume_path}. Rewrite bullet points and summaries to naturally incorporate the high-value keywords identified by the Keyword Strategist. DO NOT makeup fake experiences.',
        expected_output='A fully rewritten resume in Markdown format that incorporates the new keywords while maintaining truthfulness.',
        agent=resume_updater_agent
    )

    # Task 4: Review and Score
    task4_review_resume = Task(
        description='Analyze the newly updated resume against the original job description. Provide an ATS match score (1-100). Then, conduct a security audit on the resume to ensure no social security numbers, banking info, or inappropriate PII are present.',
        expected_output='A final review report containing: 1) The completely updated Markdown Resume. 2) ATS Match Score (1-100) and justification. 3) Security audit results.',
        agent=resume_reviewer_agent
    )

    # Task 5: File Operations
    task5_save_resume = Task(
        description='Take the final review report containing the updated resume and save it to the "new_resumes" directory. Name the file intelligently based on the job title. Wait for the file to be saved.',
        expected_output='Confirmation that the file was successfully saved.',
        agent=file_manager_agent
    )

    # Task 6: Evaluation Report
    task6_generate_evaluation = Task(
        description='Analyze the final updated resume against the original job description. Provide a JSON object with exactly these keys: "match_score" (integer 1-100), "chosen_keywords" (list of strings), and "missing_keywords" (list of strings). Output ONLY the JSON object, absolutely no other text or explanation.',
        expected_output='{"match_score": 85, "chosen_keywords": ["Python", "React"], "missing_keywords": ["AWS"]}',
        agent=evaluator_agent
    )

    # Assemble the Crew
    hr_crew = Crew(
        agents=[
            job_analyst_agent, 
            keyword_strategist_agent, 
            resume_updater_agent, 
            resume_reviewer_agent, 
            file_manager_agent,
            evaluator_agent
        ],
        tasks=[
            task1_analyze_jd,
            task2_find_keywords,
            task3_update_resume,
            task4_review_resume,
            task5_save_resume,
            task6_generate_evaluation
        ],
        process=Process.sequential,
        verbose=True
    )

    print("\n--- Starting HR Agent Pipeline ---")
    result = hr_crew.kickoff()
    print("\n--- Pipeline Finished ---")
    
    # Extract the JSON evaluation report from the final task
    json_report = str(result)
    
    list_of_files = glob.glob('new_resumes/*.md')
    if list_of_files:
        latest_file = max(list_of_files, key=os.path.getmtime)
        file_path = os.path.abspath(latest_file)
        if os.path.exists(file_path):
            return file_path, json_report
            
    return None, json_report

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HR Agent System for Resume Optimization")
    parser.add_argument("--url", type=str, help="URL of the job description")
    parser.add_argument("--text", type=str, help="Text of the job description")
    parser.add_argument("--resume", type=str, default="/Users/maguenza/repo/hr_agent/Kim Aguenza Resume 2025.pdf", help="Path to original PDF resume")
    
    args = parser.parse_args()
    
    if args.url:
        run_hr_pipeline(args.url, is_url=True, resume_path=args.resume)
    elif args.text:
        run_hr_pipeline(args.text, is_url=False, resume_path=args.resume)
    else:
        print("Please provide either a --url or --text argument for the job description.")
