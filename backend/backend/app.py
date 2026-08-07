from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentRequest(BaseModel):
    track: str = "Internship Preparation"
    target_role: str = "Software Intern"
    company: str = "Any"
    education: str = "B.Tech"
    experience: str = "Fresher"
    skills: str = "Python, SQL"
    resume_text: str = ""
    action_type: str

@app.post("/api/agent")
async def run_agent(data: AgentRequest):
    action_instructions = {
        "roadmap": "Provide a structured, step-by-step preparation roadmap with timelines, milestones, and core topics to master for this role.",
        "hr_questions": "Provide top behavioral and HR interview questions with professional sample answers and tips.",
        "technical": "Provide core technical interview questions, coding concepts, and problem-solving topics relevant to the skills and role.",
        "company_qs": "Provide specific interview patterns, interview rounds details, and preparation strategy for the target company.",
        "mock_interview": "Conduct a mini mock interview by asking 3 targeted technical/behavioral questions along with evaluation criteria.",
        "feedback": "Analyze the profile and resume text, identify skill gaps, and provide constructive feedback with improvement suggestions."
    }
    
    specific_instruction = action_instructions.get(data.action_type, "Provide professional career guidance.")

    prompt = f"""
    You are an expert AI Career and Interview Coach. Your task is to give accurate, highly structured, and practical guidance.
    
    Candidate Profile:
    - Target Role: {data.target_role}
    - Preferred Company: {data.company}
    - Education: {data.education}
    - Experience: {data.experience}
    - Skills Known: {data.skills}
    - Resume Summary: {data.resume_text}
    
    Selected Module: {data.action_type.upper()}
    Specific Goal: {specific_instruction}
    
    Give a clear, well-formatted, and precise response tailored strictly to the user data. Avoid generic text.
    """
    
    try:
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": "llama3",
            "prompt": prompt,
            "stream": False
        }, timeout=60)
        result = response.json()
        return {"result": result.get("response", "No response from local LLM.")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))