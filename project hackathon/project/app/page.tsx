import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-vidyai-purple to-vidyai-deep-purple flex flex-col items-center justify-center p-4">
      <div className="text-center text-white">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">VidyAI++</h1>
        <p className="text-xl md:text-2xl mb-8 opacity-90">AI-powered education for everyone</p>
        
        <div className="space-y-4">
          <Link href="/login">
            <Button size="lg" className="w-full md:w-auto bg-white text-vidyai-purple hover:bg-gray-100">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}