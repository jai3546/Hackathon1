"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if on iOS
    const ua = window.navigator.userAgent
    const iOS = !!ua.match(/iPad/i) || !!ua.match(/iPhone/i)
    const webkit = !!ua.match(/WebKit/i)
    const iOSSafari = iOS && webkit && !ua.match(/CriOS/i)
    setIsIOS(iOSSafari)

    // Listen for beforeinstallprompt event
    window.addEventListener("beforeinstallprompt", (e) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      // Stash the event so it can be triggered later
      setDeferredPrompt(e)
      setShowPrompt(true)
    })
  }, [])

  const handleInstallClick = () => {
    if (!deferredPrompt) return

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    deferredPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted the install prompt")
      } else {
        console.log("User dismissed the install prompt")
      }
      setDeferredPrompt(null)
      setShowPrompt(false)
    })
  }

  if (!showPrompt && !isIOS) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-vidyai-purple p-2 rounded-full">
            <Download className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-medium">Install VidyAI++</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isIOS ? "Add to Home Screen for the best experience" : "Install our app for offline access"}
            </p>
          </div>
        </div>
        {isIOS ? (
          <Button variant="outline" onClick={() => setShowPrompt(false)} className="ml-4">
            Got it
          </Button>
        ) : (
          <Button onClick={handleInstallClick} className="ml-4 bg-vidyai-purple hover:bg-vidyai-deep-purple">
            Install
          </Button>
        )}
      </div>

      {isIOS && (
        <div className="mt-3 text-sm">
          <p>
            1. Tap the share icon <span className="inline-block">⎙</span>
          </p>
          <p>2. Scroll down and tap "Add to Home Screen"</p>
        </div>
      )}
    </div>
  )
}
