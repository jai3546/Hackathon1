import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmotionDetector } from "@/components/emotion-detector"
import { VoiceCommandSystem } from "@/components/voice-command-system"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useState } from "react"

export default function StudentDashboard() {
  const [currentLanguage, setCurrentLanguage] = useState("english")

  const handleLanguageChange = (language: string) => {
    setCurrentLanguage(language)
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Student Dashboard</h1>
        <div className="flex items-center space-x-4">
          <LanguageSwitcher onLanguageChange={handleLanguageChange} currentLanguage={currentLanguage} />
          <VoiceCommandSystem language={currentLanguage} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Emotion Detection Card */}
        <Card>
          <CardHeader>
            <CardTitle>How are you feeling?</CardTitle>
          </CardHeader>
          <CardContent>
            <EmotionDetector 
              studentId="student1" 
              autoStart={true}
              interval={5000}
            />
          </CardContent>
        </Card>

        {/* Video Lessons Card */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Lessons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <video 
                controls 
                className="w-full rounded-lg"
                poster="/lesson-thumbnail.jpg"
              >
                <source src="/lessons/math_lesson_1.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
              <h3 className="font-semibold">Mathematics - Fractions</h3>
              <p className="text-sm text-gray-500">Learn about fractions and their operations</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 bg-vidyai-purple text-white rounded-lg hover:bg-vidyai-deep-purple transition-colors">
                <span className="block text-3xl mb-2">📚</span>
                <span>Start Quiz</span>
              </button>
              <button className="p-4 bg-vidyai-purple text-white rounded-lg hover:bg-vidyai-deep-purple transition-colors">
                <span className="block text-3xl mb-2">🤖</span>
                <span>Ask Mentor</span>
              </button>
              <button className="p-4 bg-vidyai-purple text-white rounded-lg hover:bg-vidyai-deep-purple transition-colors">
                <span className="block text-3xl mb-2">📊</span>
                <span>Progress</span>
              </button>
              <button className="p-4 bg-vidyai-purple text-white rounded-lg hover:bg-vidyai-deep-purple transition-colors">
                <span className="block text-3xl mb-2">🎯</span>
                <span>Goals</span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}