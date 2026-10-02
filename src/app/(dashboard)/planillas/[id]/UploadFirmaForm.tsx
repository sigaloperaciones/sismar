"use client"

import { useState, useRef, useTransition } from "react"
import { uploadPlanillaFirmaAction } from "@/app/actions/planillas"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Upload, FileCheck, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function UploadFirmaForm({ planillaId, currentUrl }: { planillaId: number, currentUrl?: string | null }) {
    const { toast } = useToast()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0])
        } else {
            setSelectedFile(null)
        }
    }

    const handleUpload = () => {
        if (!selectedFile) return

        const formData = new FormData()
        formData.append("firmaFile", selectedFile)

        startTransition(async () => {
            const result = await uploadPlanillaFirmaAction(planillaId, formData)
            if (result.error) {
                toast({ title: "Error", description: result.error, variant: "destructive" })
            } else {
                toast({ title: "Éxito", description: "Documento de firma subido correctamente." })
                setSelectedFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ""
                router.refresh()
            }
        })
    }

    return (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 print:hidden mt-6">
            <h3 className="font-semibold text-emerald-800 flex items-center gap-2 mb-3">
                <FileCheck className="w-5 h-5" />
                Documento de Firma (Soporte)
            </h3>
            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".pdf,image/*"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-white file:text-emerald-700 hover:file:bg-emerald-50 cursor-pointer border border-emerald-200/60 rounded-xl p-1 bg-white"
                    />
                </div>
                <Button 
                    onClick={handleUpload}
                    disabled={!selectedFile || isPending}
                    className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Subir Firma
                </Button>
            </div>
            {currentUrl && (
                <div className="mt-4 pt-4 border-t border-emerald-100 flex items-center gap-2 text-sm text-emerald-700">
                    <span className="font-medium">Ya hay un documento subido:</span>
                    <a href={currentUrl} target="_blank" rel="noreferrer" className="underline font-bold hover:text-emerald-900 transition-colors">
                        Ver Documento Actual
                    </a>
                </div>
            )}
        </div>
    )
}
