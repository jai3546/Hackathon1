from fastapi import FastAPI, Depends, HTTPException, status, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import os
import json
import uvicorn
from datetime import datetime, timedelta
import cv2
import numpy as np
import base64
from dotenv import load_dotenv
import aiofiles
import google.generativeai as genai
from jose import JWTError, jwt
import time
from deepface import DeepFace
import asyncio
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configure Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    logger.warning("GEMINI_API_KEY not found in environment variables")

app = FastAPI(
    title="VidyAI++ API",
    description="Backend API for VidyAI++ Education Platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 1 week

# Load data from JSON files
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

def load_json_data(filename):
    file_path = DATA_DIR / filename
    if not file_path.exists():
        return []
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)

# Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user_role: str
    user_id: str
    name: str
    region: str
    class_level: Optional[int] = None
    preferred_language: Optional[str] = None

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class User(BaseModel):
    id: str
    username: str
    name: str
    role: str
    region: str
    class_level: Optional[int] = None
    preferred_language: Optional[str] = "english"
    disabled: Optional[bool] = None

class UserInDB(User):
    password: str

class EmotionData(BaseModel):
    timestamp: str
    emotion: str
    confidence: float

class QuizRequest(BaseModel):
    subject: str
    topic: str
    difficulty: str
    regional_context: Optional[str] = None
    language: Optional[str] = "english"
    class_level: Optional[int] = 5

class QuizResponse(BaseModel):
    questions: List[Dict[str, Any]]
    audio_prompts: Optional[Dict[str, str]] = None

class VoiceCommandRequest(BaseModel):
    audio_data: str  # Base64 encoded audio
    language: str = "english"

class VoiceCommandResponse(BaseModel):
    command: str
    confidence: float
    action: str

class MentorRequest(BaseModel):
    message: str
    language: str = "english"
    student_id: str
    emotion: Optional[str] = None

class MentorResponse(BaseModel):
    text_response: str
    audio_response: Optional[str] = None  # Base64 encoded audio
    suggestions: List[str] = []

# Authentication functions
def get_user(username: str):
    users = load_json_data("students.json") + load_json_data("mentors.json")
    for user in users:
        if user.get("username") == username:
            return UserInDB(**user)
    return None

def authenticate_user(username: str, password: str):
    user = get_user(username)
    if not user:
        return False
    if user.password != password:  # In production, use proper password hashing
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

# Helper functions
def get_syllabus_map():
    return load_json_data("syllabus_map.json")

def get_emotion_response(emotion: str, language: str = "english"):
    responses = {
        "sad": {
            "english": "I notice you seem sad. Can I help you with something?",
            "telugu": "మీరు బాధగా ఉన్నట్లు కనిపిస్తోంది. నేను మీకు ఏదైనా సహాయం చేయగలనా?",
            "hindi": "मुझे लगता है कि आप उदास हैं। क्या मैं आपकी कुछ मदद कर सकता हूँ?"
        },
        "angry": {
            "english": "I see you're frustrated. Let's take a break or try a different approach.",
            "telugu": "మీరు నిరాశగా ఉన్నారు. విరామం తీసుకుందాం లేదా వేరే విధానాన్ని ప్రయత్నిద్దాం.",
            "hindi": "मैं देख रहा हूं कि आप निराश हैं। चलिए एक ब्रेक लेते हैं या एक अलग दृष्टिकोण से प्रयास करते हैं।"
        },
        "fear": {
            "english": "Don't worry, learning new things can be challenging. I'm here to help.",
            "telugu": "చింతించకండి, కొత్త విషయాలు నేర్చుకోవడం కష్టంగా ఉండవచ్చు. నేను మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను.",
            "hindi": "चिंता मत करो, नई चीजें सीखना चुनौतीपूर्ण हो सकता है। मैं आपकी मदद के लिए यहां हूं।"
        },
        "disgust": {
            "english": "Let's find something more interesting for you to learn.",
            "telugu": "మీరు నేర్చుకోవడానికి మరింత ఆసక్తికరమైన దాన్ని కనుగొందాం.",
            "hindi": "चलिए आपके लिए सीखने के लिए कुछ और दिलचस्प खोजते हैं।"
        },
        "happy": {
            "english": "I'm glad to see you're enjoying the lesson!",
            "telugu": "మీరు పాఠాన్ని ఆస్వాదిస్తున్నారని చూసి నేను సంతోషిస్తున్నాను!",
            "hindi": "मुझे खुशी है कि आप पाठ का आनंद ले रहे हैं!"
        },
        "surprise": {
            "english": "That's interesting! Would you like to learn more about this topic?",
            "telugu": "అది ఆసక్తికరంగా ఉంది! మీరు ఈ అంశం గురించి మరింత తెలుసుకోవాలనుకుంటున్నారా?",
            "hindi": "यह दिलचस्प है! क्या आप इस विषय के बारे में अधिक जानना चाहेंगे?"
        },
        "neutral": {
            "english": "How are you finding the lesson so far?",
            "telugu": "మీరు ఇప్పటివరకు పాఠాన్ని ఎలా కనుగొంటున్నారు?",
            "hindi": "आपको अब तक का पाठ कैसा लग रहा है?"
        },
        "tired": {
            "english": "You seem tired. Would you like to take a short break?",
            "telugu": "మీరు అలసిపోయినట్లు కనిపిస్తున్నారు. మీరు చిన్న విరామం తీసుకోవాలనుకుంటున్నారా?",
            "hindi": "आप थके हुए लगते हैं। क्या आप एक छोटा ब्रेक लेना चाहेंगे?"
        },
        "confused": {
            "english": "You seem confused. Let me explain this in a different way.",
            "telugu": "మీరు గందరగోళంగా ఉన్నట్లు కనిపిస్తున్నారు. నేను దీన్ని వేరే విధంగా వివరిస్తాను.",
            "hindi": "आप भ्रमित लगते हैं। मुझे इसे एक अलग तरीके से समझाने दें।"
        }
    }
    
    emotion_key = emotion.lower()
    if emotion_key not in responses:
        emotion_key = "neutral"
    
    language_key = language.lower()
    if language_key not in responses[emotion_key]:
        language_key = "english"
    
    return responses[emotion_key][language_key]

async def generate_quiz_with_gemini(request: QuizRequest):
    if not GEMINI_API_KEY:
        # Return mock data if no API key
        return mock_quiz_data(request)
    
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        # Create prompt based on request
        prompt = f"""
        Create a quiz for class {request.class_level} students on the topic of {request.topic} in {request.subject}.
        The quiz should be appropriate for students in {request.regional_context or 'India'} and be at a {request.difficulty} difficulty level.
        
        Format the response as a JSON array with 5 questions. Each question should have:
        1. The question text
        2. Four options (A, B, C, D)
        3. The correct answer
        4. A brief explanation of why that's the correct answer
        
        The response should be in {request.language} language.
        """
        
        response = model.generate_content(prompt)
        
        # Extract JSON from response
        response_text = response.text
        
        # Find JSON content between ```json and ```
        import re
        json_match = re.search(r'```json\n(.*?)\n```', response_text, re.DOTALL)
        if json_match:
            json_content = json_match.group(1)
        else:
            # Try to find any content that looks like JSON
            json_content = re.search(r'\[\s*\{.*\}\s*\]', response_text, re.DOTALL)
            if json_content:
                json_content = json_content.group(0)
            else:
                json_content = response_text
        
        try:
            questions = json.loads(json_content)
            
            # Generate audio prompts
            audio_prompts = {
                "intro": f"Welcome to your {request.subject} quiz on {request.topic}",
                "correct": "That's correct! Well done!",
                "incorrect": "That's not quite right. Let's try again."
            }
            
            return {
                "questions": questions,
                "audio_prompts": audio_prompts
            }
        except json.JSONDecodeError:
            logger.error(f"Failed to parse JSON from Gemini response: {response_text}")
            return mock_quiz_data(request)
            
    except Exception as e:
        logger.error(f"Error generating quiz with Gemini: {str(e)}")
        return mock_quiz_data(request)

def mock_quiz_data(request: QuizRequest):
    # Mock data for when Gemini API is not available
    questions = []
    
    if request.language.lower() == "telugu":
        questions = [
            {
                "question": f"{request.topic} గురించి ప్రశ్న 1?",
                "options": ["ఎంపిక A", "ఎంపిక B", "ఎంపిక C", "ఎంపిక D"],
                "correct_answer": "ఎంపిక B",
                "explanation": "ఇది సరైన సమాధానం ఎందుకంటే..."
            },
            {
                "question": f"{request.topic} గురించి ప్రశ్న 2?",
                "options": ["ఎంపిక A", "ఎంపిక B", "ఎంపిక C", "ఎంపిక D"],
                "correct_answer": "ఎంపిక A",
                "explanation": "ఇది సరైన సమాధానం ఎందుకంటే..."
            }
        ]
    else:
        questions = [
            {
                "question": f"Question 1 about {request.topic}?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "Option B",
                "explanation": "This is the correct answer because..."
            },
            {
                "question": f"Question 2 about {request.topic}?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "Option A",
                "explanation": "This is the correct answer because..."
            }
        ]
    
    audio_prompts = {
        "intro": f"Welcome to your {request.subject} quiz on {request.topic}",
        "correct": "That's correct! Well done!",
        "incorrect": "That's not quite right. Let's try again."
    }
    
    return {
        "questions": questions,
        "audio_prompts": audio_prompts
    }

async def generate_mentor_response(request: MentorRequest):
    if not GEMINI_API_KEY:
        return mock_mentor_response(request)
    
    try:
        model = genai.GenerativeModel('gemini-pro')
        
        # Create context based on student emotion if available
        emotion_context = ""
        if request.emotion:
            emotion_context = f"The student appears to be {request.emotion}. Respond with empathy to this emotion."
        
        # Create prompt based on request
        prompt = f"""
        You are an AI educational mentor for a student. 
        {emotion_context}
        
        The student's message is: "{request.message}"
        
        Provide a helpful, encouraging, and educational response in {request.language} language.
        Keep your response concise (under 100 words) and appropriate for a school student.
        Also suggest 2-3 follow-up questions the student might want to ask.
        """
        
        response = model.generate_content(prompt)
        
        # Process the response
        mentor_text = response.text
        
        # Extract suggestions (could be more sophisticated in production)
        suggestions = []
        if "follow-up" in mentor_text.lower() or "questions" in mentor_text.lower():
            # Simple extraction - in production would use more robust parsing
            suggestion_section = mentor_text.split("follow-up questions")[-1] if "follow-up questions" in mentor_text.lower() else ""
            if not suggestion_section:
                suggestion_section = mentor_text.split("questions")[-1] if "questions" in mentor_text.lower() else ""
            
            if suggestion_section:
                # Extract numbered or bulleted items
                import re
                suggestion_items = re.findall(r'[•\-\d]+\.\s*(.*?)(?=(?:[•\-\d]+\.)|$)', suggestion_section, re.DOTALL)
                if suggestion_items:
                    suggestions = [item.strip() for item in suggestion_items if item.strip()]
                else:
                    # Just take the last few sentences as suggestions
                    sentences = re.split(r'[.!?]', suggestion_section)
                    suggestions = [s.strip() for s in sentences if s.strip()][:3]
        
        # In a real app, would generate audio here
        
        return {
            "text_response": mentor_text.split("follow-up questions")[0] if "follow-up questions" in mentor_text.lower() else mentor_text,
            "suggestions": suggestions or ["What should I learn next?", "Can you explain this again?", "How does this apply to real life?"]
        }
            
    except Exception as e:
        logger.error(f"Error generating mentor response with Gemini: {str(e)}")
        return mock_mentor_response(request)

def mock_mentor_response(request: MentorRequest):
    # Mock data for when Gemini API is not available
    if request.language.lower() == "telugu":
        return {
            "text_response": "మీ ప్రశ్నకు స్వాగతం! నేను మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను. మీరు ఏమి నేర్చుకోవాలనుకుంటున్నారు?",
            "suggestions": ["నేను తదుపరి ఏమి నేర్చుకోవాలి?", "మీరు దీన్ని మళ్లీ వివరించగలరా?", "ఇది నిజ జీవితానికి ఎలా వర్తిస్తుంది?"]
        }
    else:
        return {
            "text_response": "Welcome to your question! I'm here to help you learn. What would you like to know more about?",
            "suggestions": ["What should I learn next?", "Can you explain this again?", "How does this apply to real life?"]
        }

# Routes
@app.post("/api/v1/auth/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_role": user.role,
        "user_id": user.id,
        "name": user.name,
        "region": user.region,
        "class_level": user.class_level,
        "preferred_language": user.preferred_language
    }

@app.get("/api/v1/auth/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/api/v1/gemini-quiz", response_model=QuizResponse)
async def generate_quiz(
    request: QuizRequest,
    current_user: User = Depends(get_current_user)
):
    quiz_data = await generate_quiz_with_gemini(request)
    return quiz_data

@app.post("/api/v1/face-auth")
async def face_authentication(file: UploadFile = File(...), student_id: str = Form(...)):
    try:
        # Save the uploaded file temporarily
        temp_file_path = f"temp_{file.filename}"
        async with aiofiles.open(temp_file_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)
        
        # Process with DeepFace
        img = cv2.imread(temp_file_path)
        result = DeepFace.analyze(img, actions=['emotion'])
        
        # Get the dominant emotion
        emotion = result[0]['dominant_emotion']
        emotion_scores = result[0]['emotion']
        
        # Clean up the temporary file
        os.remove(temp_file_path)
        
        # Get student data to determine preferred language
        students = load_json_data("students.json")
        student = next((s for s in students if s.get("id") == student_id), None)
        language = student.get("preferred_language", "english") if student else "english"
        
        # Get appropriate response based on emotion and language
        response_text = get_emotion_response(emotion, language)
        
        # In a real app, would log emotion to database
        
        return {
            "emotion": emotion,
            "confidence": emotion_scores[emotion],
            "response": response_text,
            "all_emotions": emotion_scores
        }
    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}"
        )

@app.post("/api/v1/voice-command")
async def process_voice_command(request: VoiceCommandRequest):
    try:
        # In a real app, would process the audio with speech recognition
        # For demo, we'll simulate voice command recognition
        
        # Decode base64 audio
        # audio_bytes = base64.b64decode(request.audio_data)
        
        # Simulate processing delay
        await asyncio.sleep(1)
        
        # Mock response - in production would use actual speech recognition
        commands = {
            "english": ["go to dashboard", "take quiz", "show video", "ask mentor"],
            "telugu": ["డాష్‌బోర్డ్‌కి వెళ్ళండి", "క్విజ్ తీసుకోండి", "వీడియో చూపించు", "మెంటార్‌ని అడగండి"],
            "hindi": ["डैशबोर्ड पर जाएं", "क्विज़ लें", "वीडियो दिखाएं", "मेंटर से पूछें"]
        }
        
        language = request.language.lower()
        if language not in commands:
            language = "english"
        
        # Simulate recognized command
        import random
        command = random.choice(commands[language])
        
        # Map command to action
        action_map = {
            "go to dashboard": "navigate_to_dashboard",
            "take quiz": "start_quiz",
            "show video": "play_video",
            "ask mentor": "open_mentor",
            "డాష్‌బోర్డ్‌కి వెళ్ళండి": "navigate_to_dashboard",
            "క్విజ్ తీసుకోండి": "start_quiz",
            "వీడియో చూపించు": "play_video",
            "మెంటార్‌ని అడగండి": "open_mentor",
            "डैशबोर्ड पर जाएं": "navigate_to_dashboard",
            "क्विज़ लें": "start_quiz",
            "वीडियो दिखाएं": "play_video",
            "मेंटर से पूछें": "open_mentor"
        }
        
        action = action_map.get(command, "unknown_command")
        
        return {
            "command": command,
            "confidence": 0.85,
            "action": action
        }
    except Exception as e:
        logger.error(f"Error processing voice command: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing voice command: {str(e)}"
        )

@app.post("/api/v1/mentor-chat", response_model=MentorResponse)
async def chat_with_mentor(
    request: MentorRequest,
    current_user: User = Depends(get_current_user)
):
    response = await generate_mentor_response(request)
    return response

@app.get("/api/v1/lessons/{region}/{class_level}/{subject}/{language}")
async def get_lesson(
    region: str,
    class_level: int,
    subject: str,
    language: str,
    current_user: User = Depends(get_current_user)
):
    # In a real app, would fetch lesson content from database or file system
    # For demo, return mock data
    
    syllabus_map = get_syllabus_map()
    
    # Find matching lesson
    lesson = None
    for item in syllabus_map:
        if (item.get("region") == region and 
            item.get("class_level") == class_level and 
            item.get("subject") == subject):
            lesson = item
            break
    
    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found"
        )
    
    # Get content in requested language
    content = lesson.get("content", {}).get(language)
    if not content:
        # Fallback to English
        content = lesson.get("content", {}).get("english", "Lesson content not available")
    
    return {
        "title": lesson.get("title", f"{subject} for Class {class_level}"),
        "description": lesson.get("description", "Learn with VidyAI++"),
        "content": content,
        "video_url": lesson.get("video_url", {}).get(language, lesson.get("video_url", {}).get("english", "")),
        "resources": lesson.get("resources", [])
    }

@app.get("/api/v1/skill-map/{student_id}")
async def get_skill_map(
    student_id: str,
    current_user: User = Depends(get_current_user)
):
    # In a real app, would fetch skill data from database
    # For demo, return mock data
    
    # Check if the current user has permission to access this student's data
    if current_user.role != "mentor" and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this student's data"
        )
    
    # Get student data
    students = load_json_data("students.json")
    student = next((s for s in students if s.get("id") == student_id), None)
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Generate skill heatmap data
    subjects = ["Math", "Science", "Language", "History", "Geography"]
    skills = ["Understanding", "Application", "Analysis", "Creation", "Evaluation"]
    
    heatmap_data = []
    for subject in subjects:
        subject_data = []
        for skill in skills:
            # Generate a random score between 30 and 100 for demo purposes
            # In a real app, this would be calculated from actual performance data
            score = np.random.randint(30, 100)
            subject_data.append({
                "skill": skill,
                "score": score
            })
        heatmap_data.append({
            "subject": subject,
            "skills": subject_data
        })
    
    return {
        "student_id": student_id,
        "student_name": student.get("name", "Unknown"),
        "class_level": student.get("class_level", "Unknown"),
        "skill_heatmap": heatmap_data
    }

@app.on_event("startup")
async def startup_event():
    # Create sample data files if they don't exist
    os.makedirs(DATA_DIR, exist_ok=True)
    
    # Create students.json if it doesn't exist
    students_path = DATA_DIR / "students.json"
    if not students_path.exists():
        sample_students = [
            {
                "id": "student1",
                "username": "student1",
                "password": "password123",
                "name": "Ravi Kumar",
                "role": "student",
                "region": "Andhra Pradesh",
                "class_level": 6,
                "preferred_language": "telugu",
                "disabled": False
            },
            {
                "id": "student2",
                "username": "student2",
                "password": "password123",
                "name": "Priya Sharma",
                "role": "student",
                "region": "Telangana",
                "class_level": 8,
                "preferred_language": "english",
                "disabled": False
            }
        ]
        with open(students_path, 'w', encoding='utf-8') as f:
            json.dump(sample_students, f, indent=2)
    
    # Create mentors.json if it doesn't exist
    mentors_path = DATA_DIR / "mentors.json"
    if not mentors_path.exists():
        sample_mentors = [
            {
                "id": "mentor1",
                "username": "mentor1",
                "password": "mentor123",
                "name": "Anand Rao",
                "role": "mentor",
                "region": "Andhra Pradesh",
                "disabled": False
            },
            {
                "id": "mentor2",
                "username": "mentor2",
                "password": "mentor123",
                "name": "Lakshmi Devi",
                "role": "mentor",
                "region": "Telangana",
                "disabled": False
            }
        ]
        with open(mentors_path, 'w', encoding='utf-8') as f:
            json.dump(sample_mentors, f, indent=2)
    
    # Create syllabus_map.json if it doesn't exist
    syllabus_path = DATA_DIR / "syllabus_map.json"
    if not syllabus_path.exists():
        sample_syllabus = [
            {
                "region": "Andhra Pradesh",
                "class_level": 6,
                "subject": "Math",
                "title": "Fractions and Decimals",
                "description": "Learn about fractions, decimals, and their operations",
                "content": {
                    "english": "# Fractions and Decimals\n\nFractions represent parts of a whole. For example, in the fraction 3/4, the number on top (3) is called the numerator, and the number at the bottom (4) is called the denominator.\n\n## Adding Fractions\n\nTo add fractions with the same denominator, add the numerators and keep the denominator the same.\n\nExample: 1/5 + 2/5 = 3/5",
                    "telugu": "# భిన్నాలు మరియు దశాంశాలు\n\nభిన్నాలు మొత్తంలో భాగాలను సూచిస్తాయి. ఉదాహరణకు, 3/4 భిన్నంలో, పైన ఉన్న సంఖ్య (3) న్యూమరేటర్ అని పిలుస్తారు, మరియు దిగువన ఉన్న సంఖ్య (4) డినామినేటర్ అని పిలుస్తారు.\n\n## భిన్నాలను కలపడం\n\nఒకే డినామినేటర్‌తో భిన్నాలను కలపడానికి, న్యూమరేటర్‌లను కలపండి మరియు డినామినేటర్‌ను అలాగే ఉంచండి.\n\nఉదాహరణ: 1/5 + 2/5 = 3/5",
                    "hindi": "# भिन्न और दशमलव\n\nभिन्न एक पूर्ण के हिस्सों का प्रतिनिधित्व करते हैं। उदाहरण के लिए, भिन्न 3/4 में, ऊपर की संख्या (3) को अंश कहा जाता है, और नीचे की संख्या (4) को हर कहा जाता है।\n\n## भिन्नों को जोड़ना\n\nसमान हर वाले भिन्नों को जोड़ने के लिए, अंशों को जोड़ें और हर को वही रखें।\n\nउदाहरण: 1/5 + 2/5 = 3/5"
                },
                "video_url": {
                    "english": "/lessons/AP/6/Math/english/fractions.mp4",
                    "telugu": "/lessons/AP/6/Math/telugu/fractions.mp4",
                    "hindi": "/lessons/AP/6/Math/hindi/fractions.mp4"
                },
                "resources": [
                    {
                        "title": "Fraction Worksheet",
                        "url": "/resources/AP/6/Math/fraction_worksheet.pdf"
                    }
                ]
            },
            {
                "region": "Telangana",
                "class_level": 8,
                "subject": "Science",
                "title": "Solar System",
                "description": "Learn about planets, stars, and other celestial bodies",
                "content": {
                    "english": "# The Solar System\n\nThe Solar System consists of the Sun and everything that orbits around it, including planets, moons, asteroids, and comets.\n\n## Planets\n\nThere are eight planets in our Solar System: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.",
                    "telugu": "# సౌర వ్యవస్థ\n\nసౌర వ్యవస్థలో సూర్యుడు మరియు దాని చుట్టూ తిరిగే ప్రతిదీ ఉంటుంది, అందులో గ్రహాలు, చంద్రులు, గ్రహశకలాలు మరియు తోకచుక్కలు ఉన్నాయి.\n\n## గ్రహాలు\n\nమన సౌర వ్యవస్థలో ఎనిమిది గ్రహాలు ఉన్నాయి: బుధుడు, శుక్రుడు, భూమి, అంగారకుడు, గురుడు, శని, యురేనస్ మరియు నెప్ట్యూన్.",
                    "hindi": "# सौर मंडल\n\nसौर मंडल में सूरज और उसके चारों ओर परिक्रमा करने वाली हर चीज शामिल है, जिसमें ग्रह, चंद्रमा, क्षुद्रग्रह और धूमकेतु शामिल हैं।\n\n## ग्रह\n\nहमारे सौर मंडल में आठ ग्रह हैं: बुध, शुक्र, पृथ्वी, मंगल, बृहस्पति, शनि, यूरेनस और नेपच्यून।"
                },
                "video_url": {
                    "english": "/lessons/TS/8/Science/english/solar_system.mp4",
                    "telugu": "/lessons/TS/8/Science/telugu/solar_system.mp4",
                    "hindi": "/lessons/TS/8/Science/hindi/solar_system.mp4"
                },
                "resources": [
                    {
                        "title": "Planet Chart",
                        "url": "/resources/TS/8/Science/planet_chart.pdf"
                    }
                ]
            }
        ]
        with open(syllabus_path, 'w', encoding='utf-8') as f:
            json.dump(sample_syllabus, f, indent=2)
    
    logger.info("Sample data files created successfully")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
