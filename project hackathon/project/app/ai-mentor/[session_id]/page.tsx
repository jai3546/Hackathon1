"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Mic, Send, VolumeIcon as VolumeUp } from "lucide-react"

interface MentorSessionPageProps {
  params: {
    session_id: string
  }
}

export default function MentorSessionPage({ params }: MentorSessionPageProps) {
  const { session_id } = params
  const [message, setMessage] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `Welcome to mentor session #${session_id}. How can I help you today?`,
    },
  ])

  // In a real app, fetch session data from API
  useEffect(() => {
    // Fetch session data
    // For now, just add a simulated loading message
    const timer = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I've loaded your previous progress. Would you like to continue with your math lesson on fractions?",
        },
      ])
    }, 1000)

    return () => clearTimeout(timer)
  }, [session_id])

  const handleSendMessage = () => {
    if (!message.trim()) return

    // Add user message
    setMessages([...messages, { role: "user", content: message }])

    // Clear input
    setMessage("")

    // Simulate AI response after a short delay
    setTimeout(() => {
      let response

      if (message.toLowerCase().includes("fraction")) {
        response =
          "Fractions represent parts of a whole. For example, in the fraction 3/4, the number on top (3) is called the numerator, and the number at the bottom (4) is called the denominator. Would you like me to explain more about adding fractions?"
      } else if (message.toLowerCase().includes("help")) {
        response =
          "I'm here to help! You can ask me questions about your lessons, request explanations for difficult concepts, or get help with your homework. What subject are you studying right now?"
      } else {
        response =
          "That's a great question! I'd be happy to help you understand this topic better. Would you like me to explain with some examples?"
      }

      setMessages((prev) => [...prev, { role: "assistant", content: response }])
    }, 1000)
  }

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in your browser.")
      return
    }

    setIsListening(true)

    // Use the SpeechRecognition API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.lang = "en-US"
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setMessage(transcript)
      setIsListening(false)
    }

    recognition.onerror = () => {
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  const speakMessage = (text: string) => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in your browser.")
      return
    }

    setIsSpeaking(true)

    const utterance = new SpeechSynthesisUtterance(text)

    utterance.onend = () => {
      setIsSpeaking(false)
    }

    utterance.onerror = () => {
      setIsSpeaking(false)
    }

    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">AI Mentor Session #{session_id}</h1>
        <p className="text-muted-foreground">Get personalized help with your studies</p>
      </div>

      <Card className="h-[calc(100vh-12rem)]">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="h-10 w-10 bg-vidyai-purple">
              <AvatarImage src="/placeholder.svg?height=40&width=40" alt="AI Mentor" />
              <AvatarFallback>AI</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>AI Mentor</CardTitle>
              <CardDescription>Session #{session_id}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto h-[calc(100%-10rem)]">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    msg.role === "user" ? "bg-vidyai-purple text-white" : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <p>{msg.content}</p>

                  {msg.role === "assistant" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-8 px-2 text-xs"
                      onClick={() => speakMessage(msg.content)}
                      disabled={isSpeaking}
                    >
                      <VolumeUp className="h-3 w-3 mr-1" />
                      {isSpeaking ? "Speaking..." : "Listen"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="border-t p-4">
          <div className="flex w-full items-center space-x-2">
            <Button
              variant="outline"
              size="icon"
              className={`flex-shrink-0 ${isListening ? "bg-red-100 text-red-500 animate-pulse" : ""}`}
              onClick={handleVoiceInput}
              disabled={isListening}
            >
              <Mic className="h-4 w-4" />
              <span className="sr-only">Voice input</span>
            </Button>
            <Input
              placeholder="Type your question here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSendMessage()
                }
              }}
              className="flex-1"
            />
            <Button
              className="flex-shrink-0 bg-vidyai-purple hover:bg-vidyai-deep-purple"
              onClick={handleSendMessage}
              disabled={!message.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
