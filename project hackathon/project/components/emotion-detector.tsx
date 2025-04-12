"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { Camera, Loader2 } from "lucide-react"
import { VolumeIcon as VolumeUp } from "lucide-react"

interface EmotionDetectorProps {
  studentId: string
  onEmotionDetected?: (emotion: string, response: string) => void
  interval?: number // in milliseconds
  autoStart?: boolean
}

export function EmotionDetector({
  studentId,
  onEmotionDetected,
  interval = 10000, // Default to 10 seconds
  autoStart = false,
}: EmotionDetectorProps) {
  const [isActive, setIsActive] = useState(autoStart)
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastEmotion, setLastEmotion] = useState<string | null>(null)
  const [emotionResponse, setEmotionResponse] = useState<string | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize webcam
  useEffect(() => {
    if (isActive && videoRef.current && !videoRef.current.srcObject) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch((err) => {
          console.error("Error accessing webcam:", err)
          toast({
            title: "Camera Error",
            description: "Could not access webcam. Please check permissions.",
            variant: "destructive",
          })
          setIsActive(false)
        })
    }

    return () => {
      // Clean up video stream when component unmounts
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isActive])

  // Set up emotion detection interval
  useEffect(() => {
    if (isActive) {
      // Initial capture after a short delay to ensure camera is ready
      const initialTimeout = setTimeout(() => {
        captureAndDetectEmotion()
      }, 1000)

      // Set up interval for regular captures
      intervalRef.current = setInterval(captureAndDetectEmotion, interval)

      return () => {
        clearTimeout(initialTimeout)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }, [isActive, interval, studentId])

  const captureAndDetectEmotion = async () => {
    if (!videoRef.current || !canvasRef.current || !isActive) return

    try {
      setIsCapturing(true)

      // Capture frame from video
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      if (!context) return

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else throw new Error("Failed to create blob from canvas")
        }, "image/jpeg")
      })

      // Create form data for API request
      const formData = new FormData()
      formData.append("file", blob, "emotion-capture.jpg")
      formData.append("student_id", studentId)

      // Send to API
      const response = await fetch("/api/proxy/v1/face-auth", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      // Update state with detected emotion
      setLastEmotion(data.emotion)
      setEmotionResponse(data.response)

      // Notify parent component
      if (onEmotionDetected) {
        onEmotionDetected(data.emotion, data.response)
      }

      // Speak the response if it's a concerning emotion
      const concerningEmotions = ["sad", "angry", "fear", "disgust", "confused", "tired"]
      if (concerningEmotions.includes(data.emotion.toLowerCase())) {
        speakResponse(data.response)
      }
    } catch (error) {
      console.error("Error detecting emotion:", error)
      toast({
        title: "Detection Error",
        description: "Failed to analyze emotion. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCapturing(false)
    }
  }

  const speakResponse = (text: string) => {
    if (!("speechSynthesis" in window)) return

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

  const toggleDetector = () => {
    setIsActive(!isActive)
  }

  // Emotion color mapping
  const getEmotionColor = (emotion: string | null) => {
    if (!emotion) return "bg-gray-200"

    const emotionColors: Record<string, string> = {
      happy: "bg-green-500",
      sad: "bg-blue-500",
      angry: "bg-red-500",
      fear: "bg-purple-500",
      disgust: "bg-yellow-500",
      surprise: "bg-pink-500",
      neutral: "bg-gray-400",
      confused: "bg-orange-500",
      tired: "bg-indigo-500",
    }

    return emotionColors[emotion.toLowerCase()] || "bg-gray-400"
  }

  return (
    <div className="relative">
      {/* Hidden video and canvas elements */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Emotion display */}
      {lastEmotion && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full ${getEmotionColor(lastEmotion)}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{lastEmotion.charAt(0).toUpperCase() + lastEmotion.slice(1)}</p>
                {emotionResponse && <p className="text-sm text-muted-foreground mt-1">{emotionResponse}</p>}
              </div>
              {emotionResponse && (
                <Button variant="ghost" size="sm" onClick={() => speakResponse(emotionResponse)} disabled={isSpeaking}>
                  <VolumeUp className={`h-4 w-4 ${isSpeaking ? "animate-pulse" : ""}`} />
                  <span className="sr-only">Speak</span>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control button */}
      <Button
        variant={isActive ? "destructive" : "outline"}
        size="sm"
        onClick={toggleDetector}
        disabled={isCapturing}
        className="absolute top-2 right-2 z-10"
      >
        {isCapturing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Camera className="h-4 w-4 mr-2" />
            {isActive ? "Stop Tracking" : "Start Tracking"}
          </>
        )}
      </Button>
    </div>
  )
}
