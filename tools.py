import os
import requests
from bs4 import BeautifulSoup
import pdfplumber
from crewai.tools import BaseTool
from typing import Type
from pydantic import BaseModel, Field

class ReadJDURLInput(BaseModel):
    url: str = Field(description="The URL of the job posting.")

class ReadJDFromURLTool(BaseTool):
    name: str = "Read Job Description from URL"
    description: str = "Crawls the provided URL to extract the job description text."
    args_schema: Type[BaseModel] = ReadJDURLInput

    def _run(self, url: str) -> str:
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            for script in soup(["script", "style"]):
                script.extract()
            text = soup.get_text(separator=' ', strip=True)
            return text
        except Exception as e:
            return f"Error reading URL: {e}"

class ReadPDFInput(BaseModel):
    file_path: str = Field(description="The path to the PDF file.")

class ReadPDFResumeTool(BaseTool):
    name: str = "Read PDF Resume"
    description: str = "Reads the text content from a PDF resume file."
    args_schema: Type[BaseModel] = ReadPDFInput

    def _run(self, file_path: str) -> str:
        try:
            text = ""
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text += page.extract_text() + "\n"
            return text
        except Exception as e:
            return f"Error reading PDF: {e}"

class SaveResumeInput(BaseModel):
    content: str = Field(description="The text/markdown content of the updated resume.")
    filename: str = Field(description="The desired filename (e.g., 'kim_aguenza_updated.md').")

class SaveUpdatedResumeTool(BaseTool):
    name: str = "Save Updated Resume"
    description: str = "Saves the updated resume content to the 'new_resumes' directory."
    args_schema: Type[BaseModel] = SaveResumeInput

    def _run(self, content: str, filename: str) -> str:
        directory = "new_resumes"
        if not os.path.exists(directory):
            os.makedirs(directory)
            
        filepath = os.path.join(directory, filename)
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"Successfully saved updated resume to {filepath}"
        except Exception as e:
            return f"Error saving file: {e}"

