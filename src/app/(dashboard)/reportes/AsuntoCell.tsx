"use client"

import { useState } from "react"
import { X, FileText } from "lucide-react"

export default function AsuntoCell({ asunto }: { asunto: string }) {
    const [showPopup, setShowPopup] = useState(false)
    const truncated = asunto.length > 50

    return (
        <>
            <div
                className={`${truncated ? "cursor-pointer hover:text-indigo-600 transition-colors" : ""}`}
                onClick={() => truncated && setShowPopup(true)}
                title={truncated ? "Clic para ver completo" : undefined}
            >
                <p className="text-gray-700 text-sm">
                    {truncated ? `${asunto.substring(0, 50)}…` : asunto}
                </p>
                {truncated && (
                    <p className="text-[10px] text-indigo-400 mt-0.5">Ver más</p>
                )}
            </div>

            {showPopup && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setShowPopup(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                <span className="font-semibold text-gray-900 text-sm">Asunto Completo</span>
                            </div>
                            <button onClick={() => setShowPopup(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-gray-700 leading-relaxed">{asunto}</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
