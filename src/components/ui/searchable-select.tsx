"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Search, X } from "lucide-react"

interface Option {
    value: string
    label: string
}

interface SearchableSelectProps {
    options: Option[]
    value?: string
    onChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Seleccione una opción...",
    searchPlaceholder = "Buscar..."
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState("")
    const wrapperRef = useRef<HTMLDivElement>(null)

    const selectedOption = options.find(opt => opt.value === value)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => { setIsOpen(!isOpen); setSearch("") }}
                className="flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <span className="truncate text-gray-900">
                    {selectedOption ? selectedOption.label : <span className="text-gray-400">{placeholder}</span>}
                </span>
                <ChevronDown className="h-4 w-4 opacity-50" />
            </button>

            {isOpen && (
                <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-gray-200 bg-white text-gray-950 shadow-md">
                    <div className="flex items-center border-b border-gray-100 px-3 bg-gray-50/50">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                            type="text"
                            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
                            placeholder={searchPlaceholder}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                        {search && (
                            <button type="button" onClick={() => setSearch("")}>
                                <X className="h-3 w-3 opacity-50 hover:opacity-100" />
                            </button>
                        )}
                    </div>
                    <div className="max-h-[180px] overflow-y-auto p-1">
                        {filteredOptions.length === 0 ? (
                            <p className="py-6 text-center text-sm text-gray-500">No se encontraron resultados.</p>
                        ) : (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(opt.value)
                                        setIsOpen(false)
                                    }}
                                    className={`relative flex w-full text-left cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-gray-100 hover:text-gray-900 ${
                                        opt.value === value ? "bg-blue-50 font-medium text-blue-900" : ""
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
