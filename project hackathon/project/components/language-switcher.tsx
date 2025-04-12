"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Languages } from "lucide-react"

interface LanguageSwitcherProps {
  onLanguageChange?: (language: string) => void
  currentLanguage?: string
}

export function LanguageSwitcher({ onLanguageChange, currentLanguage = "english" }: LanguageSwitcherProps) {
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage)

  const languages = [
    { code: "english", name: "English" },
    { code: "telugu", name: "తెలుగు" },
    { code: "hindi", name: "हिंदी" },
  ]

  const handleLanguageSelect = (language: string) => {
    setSelectedLanguage(language)
    if (onLanguageChange) {
      onLanguageChange(language)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Languages className="h-4 w-4" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageSelect(language.code)}
            className={selectedLanguage === language.code ? "bg-accent" : ""}
          >
            {language.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}