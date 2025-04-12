"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Mic } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

interface VoiceCommandSystemProps {
  isListening?: boolean
  language?: string
  onCommandDetected?: (command: string, action: string) => void
}

export function VoiceCommandSystem({
  isListening: externalIsListening,
  language = "english",
  onCommandDetected,
}: VoiceCommandSystemProps) {
  const [isListening, setIsListening] = useState(externalIsListening || false)
  const router = useRouter()

  // Available voice commands and their actions
  const executeCommand = (action: string) => {
    switch (action) {
      case "navigate_to_dashboard":
        router.push("/student-dashboard")
        break
      case "start_quiz":
        router.push("/student-dashboard/quiz")
        break
      case "play_video":
        router.push("/student-dashboard/lessons")
        break
      case "open_mentor":
        router.push("/student-dashboard/mentor")
        break
      case "log_out":
        toast({
          title: "Logging out...",
          description: "You will be logged out soon.",
        })
        setTimeout(() => router.push("/login"), 1500)
        break
      case "read_aloud":
        const mainContent = document.querySelector("main")
        if (mainContent) {
          const text = mainContent.textContent || ""
          speakText(text)
        }
        break
      case "stop_speaking":
        window.speechSynthesis.cancel()
        break
      case "help":
        showHelpToast()
        break
      default:
        toast({
          title: "Unknown Command",
          description: "This command is not recognized.",
          variant: "destructive",
        })
    }
  }

  const speakText = (text: string) => {
    if (!("speechSynthesis" in window)) {
      toast({
        title: "Not Supported",
        description: "Text-to-speech is not supported in your browser.",
        variant: "destructive",
      })
      return
    }

    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utterance)
  }

  const showHelpToast = () => {
    // Show different help messages based on language
    let helpMessage = "Available commands: go to dashboard, take quiz, show video, ask mentor, log out, help"

    if (language.toLowerCase() === "telugu") {
      helpMessage = "అందుబాటులో ఉన్న ఆదేశాలు: డాష్‌బోర్డ్‌కి వెళ్ళండి, క్విజ్ తీసుకోండి, వీడియో చూపించు, మెంటార్‌ని అడగండి, లాగ్ అవుట్, సహాయం"
    } else if (language.toLowerCase() === "hindi") {
      helpMessage = "उपलब्ध कमांड: डैशबोर्ड पर जाएं, क्विज़ लें, वीडियो दिखाएं, मेंटर से पूछें, लॉग आउट, मदद"
    }

    toast({
      title: "Voice Commands Help",
      description: helpMessage,
      duration: 10000,
    })
  }

  const startListening = async () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      // If browser speech recognition is not available, use our API
      try {
        setIsListening(true)

        toast({
          title: "Listening...",
          description: "Say a command",
        })

        // In a real app, would record audio here and send to API
        // For demo, we'll simulate with a timeout
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Simulate API call
        const response = await fetch("/api/proxy/v1/voice-command", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audio_data: "base64_audio_data_would_go_here",
            language: language,
          }),
        })

        if (!response.ok) {
          throw new Error("API error")
        }

        const data = await response.json()

        toast({
          title: "Command Recognized",
          description: `Executing: ${data.command}`,
        })

        if (onCommandDetected) {
          onCommandDetected(data.command, data.action)
        }

        executeCommand(data.action)
      } catch (error) {
        console.error("Error with voice command:", error)
        toast({
          title: "Error",
          description: "There was an error processing your voice command",
          variant: "destructive",
        })
      } finally {
        setIsListening(false)
      }
      return
    }

    setIsListening(true)
    toast({
      title: "Listening...",
      description: "Say a command",
    })

    // Use the SpeechRecognition API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    // Set language based on prop
    switch (language.toLowerCase()) {
      case "telugu":
        recognition.lang = "te-IN"
        break
      case "hindi":
        recognition.lang = "hi-IN"
        break
      default:
        recognition.lang = "en-US"
    }

    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim()

      try {
        // Send to our API for processing
        const response = await fetch("/api/proxy/v1/voice-command", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            command: transcript,
            language: language,
          }),
        })

        if (!response.ok) {
          throw new Error("API error")
        }

        const data = await response.json()

        toast({
          title: "Command Recognized",
          description: `Executing: ${data.command}`,
        })

        if (onCommandDetected) {
          onCommandDetected(data.command, data.action)
        }

        executeCommand(data.action)
      } catch (error) {
        console.error("Error with voice command:", error)
        toast({
          title: "Command Not Recognized",
          description: "Try saying 'help' for available commands",
          variant: "destructive",
        })
      }

      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
      toast({
        title: "Error",
        description: "There was an error with voice recognition",
        variant: "destructive",
      })
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  // If external isListening prop changes, update our state
  useEffect(() => {
    if (externalIsListening !== undefined) {
      setIsListening(externalIsListening)
    }
  }, [externalIsListening])

  return (
    <Button
      variant="outline"
      size="icon"
      className={`rounded-full w-12 h-12 ${
        isListening
          ? "bg-red-100 text-red-500 animate-pulse border-red-200"
          : "bg-white/20 hover:bg-white/30 backdrop-blur-sm border-white/30"
      }`}
      onClick={startListening}
      disabled={isListening}
    >
      <Mic className="h-6 w-6" />
      <span className="sr-only">Voice Command</span>
    </Button>
  )
}
