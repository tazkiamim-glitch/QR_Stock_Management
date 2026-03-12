"use client"

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react"
import { Plus, Pencil, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import QRFormSheet from "@/components/qr-form-sheet"
import QRSuccessDialog from "@/components/qr-success-dialog"
import QRQuizBuilder from "@/components/qr-quiz-builder"

interface QRMapping {
  classVal: string
  program: string
  subject: string
  phase: string
  chapterId: string
  chapterName?: string
  isContentReady: boolean
  fallbackProgram?: string
  fallbackPhase?: string
  fallbackChapterId?: string
}

interface QRData {
  id: string
  name: string
  url: string
  qrType?: "chapter" | "quiz"
  quizId?: string
  // New multi-mapping structure
  mappings?: QRMapping[]
  // Backward-compat single-target fields
  class?: string
  program?: string
  subject?: string
  phase?: string
  chapterId?: string
  chapterName?: string
  isContentReady?: boolean
}

interface CMSPanelProps {
  qrDatabase: QRData[]
  setQrDatabase: (data: QRData[]) => void
  quizDatabase: any[]
  setQuizDatabase: (data: any[]) => void
}

interface BookStockRecord {
  id: string
  classVal: string
  group?: string
  program: string
  availableStock: number
}

type UploadBatchStatus = "Pending" | "Processing" | "Completed" | "Failed"

interface FailedRow {
  user_id: string
  academic_program_id: string
  is_qr: string
  error: string
}

interface UploadBatch {
  id: string
  createdBy: string
  createdTime: Date
  status: UploadBatchStatus
  fileName: string
  title?: string
  description?: string
  totalRows: number
  successCount: number
  failedRows: FailedRow[]
}

export default function CMSPanel({ qrDatabase, setQrDatabase, quizDatabase, setQuizDatabase }: CMSPanelProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [editingQR, setEditingQR] = useState<QRData | null>(null)
  const [currentQR, setCurrentQR] = useState<QRData | null>(null)
  const [activeMenu, setActiveMenu] = useState<"generate" | "quiz" | "stock" | "access">("generate")
  const [search, setSearch] = useState("")

  // --- Book Stock Management state ---
  const [bookStock, setBookStock] = useState<BookStockRecord[]>([
    {
      id: "c9-science-ssc-ap-2027",
      classVal: "Class 9",
      group: "SCI",
      program: "Class 9 - AP - SSC Batch",
      availableStock: 1500,
    },
    {
      id: "c10-science-ssc-ap-2026",
      classVal: "Class 10",
      group: "SCI",
      program: "Class 10 - AP - SSC Batch",
      availableStock: 850,
    },
  ])
  const [stockFilterClass, setStockFilterClass] = useState<string>("all")
  const [stockFilterGroup, setStockFilterGroup] = useState<string>("all")
  const [stockFilterProgram, setStockFilterProgram] = useState<string>("all")

  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false)
  const [editingStock, setEditingStock] = useState<BookStockRecord | null>(null)
  const [stockClass, setStockClass] = useState<string>("")
  const [stockGroup, setStockGroup] = useState<string>("")
  const [stockProgram, setStockProgram] = useState<string>("")
  const [stockQuantity, setStockQuantity] = useState<string>("")
  const [stockPage, setStockPage] = useState<number>(1)
  const [stockPageSize, setStockPageSize] = useState<number>(10)

  const CLASS_OPTIONS = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"]
  const GROUP_CLASSES = new Set(["Class 9", "Class 10", "Class 11", "Class 12"])
  const GROUP_OPTIONS = ["SCI", "BS", "HUM"]

  const PROGRAM_OPTIONS: Record<string, string[]> = {
    "Class 6": ["Class 6 - AP - SSC Batch"],
    "Class 7": ["Class 7 - AP - SSC Batch"],
    "Class 8": ["Class 8 - AP - SSC Batch"],
    "Class 9": ["Class 9 - AP - SSC Batch"],
    "Class 10": ["Class 10 - AP - SSC Batch"],
    "Class 11": ["Class 11 - AP - SSC Batch"],
    "Class 12": ["Class 12 - AP - SSC Batch"],
  }

  const availableProgramsForSelectedClass = useMemo(() => {
    if (!stockClass) return []
    const predefined = PROGRAM_OPTIONS[stockClass] ?? []
    const fromExisting = Array.from(
      new Set(bookStock.filter((s) => s.classVal === stockClass).map((s) => s.program)),
    )
    return Array.from(new Set([...predefined, ...fromExisting]))
  }, [stockClass, bookStock])

  const filteredBookStock = useMemo(() => {
    return bookStock.filter((record) => {
      if (stockFilterClass !== "all" && record.classVal !== stockFilterClass) return false
      if (stockFilterGroup !== "all" && (record.group || "N/A") !== stockFilterGroup) return false
      if (stockFilterProgram !== "all" && record.program !== stockFilterProgram) return false
      return true
    })
  }, [bookStock, stockFilterClass, stockFilterGroup, stockFilterProgram])

  const totalStockPages = useMemo(() => {
    if (filteredBookStock.length === 0) return 1
    return Math.max(1, Math.ceil(filteredBookStock.length / stockPageSize))
  }, [filteredBookStock.length, stockPageSize])

  const paginatedBookStock = useMemo(() => {
    const safePage = Math.min(stockPage, totalStockPages)
    const start = (safePage - 1) * stockPageSize
    return filteredBookStock.slice(start, start + stockPageSize)
  }, [filteredBookStock, stockPage, stockPageSize, totalStockPages])

  const stockPageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = []
    const maxToShow = 5

    if (totalStockPages <= maxToShow) {
      for (let i = 1; i <= totalStockPages; i++) {
        pages.push(i)
      }
      return pages
    }

    // Always show first page
    pages.push(1)

    const showLeftEllipsis = stockPage > 3
    const showRightEllipsis = stockPage < totalStockPages - 2

    if (showLeftEllipsis) {
      pages.push("ellipsis")
    }

    const start = Math.max(2, stockPage - 1)
    const end = Math.min(totalStockPages - 1, stockPage + 1)

    for (let i = start; i <= end; i++) {
      pages.push(i)
    }

    if (showRightEllipsis) {
      pages.push("ellipsis")
    }

    // Always show last page
    pages.push(totalStockPages)

    return pages
  }, [stockPage, totalStockPages])

  // --- Manage User Access via CSV state ---
  const [csvStatus, setCsvStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [csvFileName, setCsvFileName] = useState<string | null>(null)

  // --- Access upload form (Title, Description, CSV) ---
  const [isAccessFormOpen, setIsAccessFormOpen] = useState(false)
  const [accessFormTitle, setAccessFormTitle] = useState("")
  const [accessFormDescription, setAccessFormDescription] = useState("")
  const [accessFormFile, setAccessFormFile] = useState<File | null>(null)
  const accessFormFileInputRef = useRef<HTMLInputElement | null>(null)

  // --- Upload History state ---
  const [uploadHistory, setUploadHistory] = useState<UploadBatch[]>([
    {
      id: "BATCH-20260210-001",
      createdBy: "operations@shikho.com",
      createdTime: new Date("2026-02-10T11:45:00"),
      status: "Completed",
      fileName: "access-feb-10.csv",
      totalRows: 53,
      successCount: 50,
      failedRows: [
        { user_id: "user_id_abc", academic_program_id: "prog-9-sci", is_qr: "TRUE", error: "No Stock Available for Program" },
        { user_id: "user_id_xyz", academic_program_id: "prog-10-sci", is_qr: "TRUE", error: "Invalid User ID" },
        { user_id: "user_id_123", academic_program_id: "prog-9-sci", is_qr: "TRUE", error: "No Stock Available for Program" },
      ],
    },
    {
      id: "BATCH-20260208-003",
      createdBy: "admin@shikho.com",
      createdTime: new Date("2026-02-08T09:20:00"),
      status: "Completed",
      fileName: "bulk-access-feb-08.csv",
      totalRows: 120,
      successCount: 120,
      failedRows: [],
    },
    {
      id: "BATCH-20260205-002",
      createdBy: "operations@shikho.com",
      createdTime: new Date("2026-02-05T14:10:00"),
      status: "Failed",
      fileName: "access-feb-05.csv",
      totalRows: 0,
      successCount: 0,
      failedRows: [],
    },
    {
      id: "BATCH-20260201-004",
      createdBy: "admin@shikho.com",
      createdTime: new Date("2026-02-01T16:30:00"),
      status: "Pending",
      fileName: "access-feb-01.csv",
      totalRows: 0,
      successCount: 0,
      failedRows: [],
    },
  ])

  const batchCounterRef = useRef<number>(2)

  const formatBatchTimestamp = (date: Date): string => {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) + " " + date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
  }

  const handleDownloadFailureLog = (batch: UploadBatch) => {
    const header = "user_id,academic_program_id,is_qr,error"
    const rows = batch.failedRows.map(
      (r) => `${r.user_id},${r.academic_program_id},${r.is_qr},"${r.error}"`,
    )
    const csvContent = [header, ...rows].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `failure-log-${batch.id}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleAddNew = () => {
    setEditingQR(null)
    setIsFormOpen(true)
  }

  const handleEdit = (qr: QRData) => {
    setEditingQR(qr)
    setIsFormOpen(true)
  }

  const handleSubmit = (qrData: QRData) => {
    if (editingQR) {
      setQrDatabase(qrDatabase.map((qr) => (qr.id === editingQR.id ? qrData : qr)))
    } else {
      setQrDatabase([...qrDatabase, qrData])
      setCurrentQR(qrData)
      setIsSuccessOpen(true)
    }
    setIsFormOpen(false)
  }

  const resetStockFormState = () => {
    setStockClass("")
    setStockGroup("")
    setStockProgram("")
    setStockQuantity("")
    setEditingStock(null)
  }

  const openAddStockDialog = () => {
    resetStockFormState()
    setIsStockDialogOpen(true)
  }

  const openEditStockDialog = (record: BookStockRecord) => {
    setEditingStock(record)
    setStockClass(record.classVal)
    setStockGroup(record.group ?? "")
    setStockProgram(record.program)
    setStockQuantity(String(record.availableStock))
    setIsStockDialogOpen(true)
  }

  const handleStockSubmit = () => {
    const quantityNumber = Number(stockQuantity)
    if (!stockClass || !stockProgram || Number.isNaN(quantityNumber) || quantityNumber < 0) {
      // Basic guard; in a real app we might show inline validation messages.
      return
    }

    if (editingStock) {
      setBookStock((prev) =>
        prev.map((record) =>
          record.id === editingStock.id
            ? {
                ...record,
                availableStock: quantityNumber,
              }
            : record,
        ),
      )
    } else {
      const newRecord: BookStockRecord = {
        id: `${stockClass}-${stockGroup || "na"}-${stockProgram}`.toLowerCase().replace(/\s+/g, "-"),
        classVal: stockClass,
        group: GROUP_CLASSES.has(stockClass) ? stockGroup || undefined : undefined,
        program: stockProgram,
        availableStock: quantityNumber,
      }
      setBookStock((prev) => [...prev, newRecord])
    }

    setIsStockDialogOpen(false)
    resetStockFormState()
  }

  // Reset stock pagination when filters change
  useEffect(() => {
    setStockPage(1)
  }, [stockFilterClass, stockFilterGroup, stockFilterProgram])

  const handleDownloadTemplate = () => {
    const csvContent = "user_id,academic_program_id,is_qr\n"
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "qr-access-template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const submitCsvBatch = (file: File, options?: { title?: string; description?: string }) => {
    const isCsv = file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv")
    if (!isCsv) {
      setCsvStatus("error")
      return false
    }

    setCsvFileName(file.name)
    setCsvStatus("processing")

    const now = new Date()
    batchCounterRef.current += 1
    const batchId = `BATCH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(batchCounterRef.current).padStart(3, "0")}`

    const newBatch: UploadBatch = {
      id: batchId,
      createdBy: "operations@shikho.com",
      createdTime: now,
      status: "Pending",
      fileName: file.name,
      title: options?.title || undefined,
      description: options?.description || undefined,
      totalRows: 0,
      successCount: 0,
      failedRows: [],
    }

    setUploadHistory((prev) => [newBatch, ...prev])

    setTimeout(() => {
      setUploadHistory((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, status: "Processing" } : b)),
      )
    }, 1000)

    setTimeout(() => {
      const simulatedFailed: FailedRow[] = [
        { user_id: "user_id_abc", academic_program_id: "prog-9-sci", is_qr: "TRUE", error: "No Stock Available for Program" },
        { user_id: "user_id_xyz", academic_program_id: "prog-10-sci", is_qr: "TRUE", error: "Invalid User ID" },
        { user_id: "user_id_123", academic_program_id: "prog-9-sci", is_qr: "TRUE", error: "No Stock Available for Program" },
      ]
      setUploadHistory((prev) =>
        prev.map((b) =>
          b.id === batchId
            ? { ...b, status: "Completed", totalRows: 53, successCount: 50, failedRows: simulatedFailed }
            : b,
        ),
      )
      setCsvStatus("success")
    }, 3000)

    return true
  }

  const openAccessForm = () => {
    setAccessFormTitle("")
    setAccessFormDescription("")
    setAccessFormFile(null)
    if (accessFormFileInputRef.current) accessFormFileInputRef.current.value = ""
    setIsAccessFormOpen(true)
  }

  const handleAccessFormFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setAccessFormFile(file || null)
  }

  const handleAccessFormSubmit = () => {
    if (!accessFormTitle.trim()) return
    if (!accessFormFile) return
    const ok = submitCsvBatch(accessFormFile, {
      title: accessFormTitle.trim(),
      description: accessFormDescription.trim() || undefined,
    })
    if (ok) {
      setAccessFormTitle("")
      setAccessFormDescription("")
      setAccessFormFile(null)
      if (accessFormFileInputRef.current) accessFormFileInputRef.current.value = ""
      setIsAccessFormOpen(false)
    }
  }


  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="p-5 border-b">
          <h1 className="text-2xl font-bold text-purple-600">Shikho</h1>
        </div>
        <nav className="p-4">
          <div className="px-4 py-3 rounded-md bg-purple-50 text-purple-600 font-medium cursor-pointer">
            <span className="mr-3">📊</span>
            Dashboard
          </div>
          <div className="px-4 py-3 rounded-md font-medium cursor-pointer mt-1">
            <span className="mr-3">🔲</span>
            QR Management
          </div>
          <div className="ml-8 mt-1 space-y-1">
            <button
              onClick={() => setActiveMenu("generate")}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeMenu === "generate" ? "bg-purple-100 text-purple-700" : "hover:bg-muted"
              }`}
            >
              Map QR
            </button>
            <button
              onClick={() => setActiveMenu("quiz")}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeMenu === "quiz" ? "bg-purple-100 text-purple-700" : "hover:bg-muted"
              }`}
            >
              QR Quiz
            </button>
            <button
              onClick={() => setActiveMenu("stock")}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeMenu === "stock" ? "bg-purple-100 text-purple-700" : "hover:bg-muted"
              }`}
            >
              Stock Management
            </button>
            <button
              onClick={() => setActiveMenu("access")}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                activeMenu === "access" ? "bg-purple-100 text-purple-700" : "hover:bg-muted"
              }`}
            >
              Manage User Access
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="text-sm text-muted-foreground mb-4">
          DASHBOARD / <span className="font-semibold text-foreground">QR MANAGEMENT</span>
          <span className="text-muted-foreground">
            {" "}
            /{" "}
            {activeMenu === "generate"
              ? "Map QR"
              : activeMenu === "quiz"
                ? "QR Quiz"
                : activeMenu === "stock"
                  ? "Book Stock Management"
                  : "Manage User Access"}
          </span>
        </div>
        {activeMenu === "generate" ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>QR Codes Table</CardTitle>
              <div className="flex items-center gap-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or ID"
                  className="border rounded px-3 py-2 text-sm w-64"
                />
                <Button onClick={handleAddNew} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New QR
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>QR ID</TableHead>
                    <TableHead>Target Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qrDatabase.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No QR codes yet. Create one to get started!
                      </TableCell>
                    </TableRow>
                  ) : (
                    qrDatabase
                      .filter((qr) =>
                        `${qr.name} ${qr.id}`.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((qr) => (
                      <TableRow key={qr.id}>
                        <TableCell className="font-medium">{qr.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{qr.id}</code>
                        </TableCell>
                        <TableCell className="text-sm">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="cursor-pointer">
                                  {qr.qrType === "quiz" ? (
                                    <span>QR Quiz</span>
                                  ) : qr.qrType === "shikho_ai" ? (
                                    <span>Shikho AI</span>
                                  ) : qr.qrType === "animated_video" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      <div>
                                        <div>
                                          {qr.mappings[0].subject}
                                          {qr.mappings[0].chapterName ? ` > ${(qr.mappings[0].chapterName || "").substring(0, 30)}` : ""}
                                        </div>
                                        {qr.mappings.length > 1 && (
                                          <div className="text-xs text-muted-foreground">+ {qr.mappings.length - 1} more mapping{qr.mappings.length - 1 > 1 ? "s" : ""}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span>Animated Video Lesson</span>
                                    )
                                  ) : qr.qrType === "lecture_class" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      <div>
                                        <div>
                                          {qr.mappings[0].program} &gt; {qr.mappings[0].subject} &gt; {(qr.mappings[0].chapterName || "").substring(0, 30)}
                                        </div>
                                        {qr.mappings.length > 1 && (
                                          <div className="text-xs text-muted-foreground">+ {qr.mappings.length - 1} more mapping{qr.mappings.length - 1 > 1 ? "s" : ""}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span>Lecture Class</span>
                                    )
                                  ) : qr.qrType === "live_exam" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      <div>
                                        <div>
                                          {qr.mappings[0].program} &gt; {qr.mappings[0].subject} &gt; {(qr.mappings[0].chapterName || "").substring(0, 30)}
                                        </div>
                                        {qr.mappings.length > 1 && (
                                          <div className="text-xs text-muted-foreground">+ {qr.mappings.length - 1} more mapping{qr.mappings.length - 1 > 1 ? "s" : ""}</div>
                                        )}
                                      </div>
                                    ) : (
                                      <span>Live Exam</span>
                                    )
                                  ) : Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                    <div>
                                      <div>
                                        {qr.mappings[0].program} &gt; {qr.mappings[0].subject} &gt; {(qr.mappings[0].chapterName || "").substring(0, 30)}
                                      </div>
                                      {qr.mappings.length > 1 && (
                                        <div className="text-xs text-muted-foreground">+ {qr.mappings.length - 1} more mapping{qr.mappings.length - 1 > 1 ? "s" : ""}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span>
                                      {qr.program} &gt; {qr.subject} &gt; {(qr.chapterName || "").substring(0, 30)}
                                    </span>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-md">
                                <div className="space-y-1">
                                  {qr.qrType === "quiz" ? (
                                    <div>QR Quiz</div>
                                  ) : qr.qrType === "shikho_ai" ? (
                                    <div>Shikho AI</div>
                                  ) : qr.qrType === "animated_video" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      qr.mappings.map((m, idx) => (
                                        <div key={idx}>
                                          {m.classVal ? `${m.classVal.toUpperCase()} > ` : ""}
                                          {m.program ? `${m.program} > ` : ""}
                                          {m.subject}
                                          {m.chapterName ? ` > ${m.chapterName}` : " (Subject Level)"}
                                        </div>
                                      ))
                                    ) : (
                                      <div>Animated Video Lesson</div>
                                    )
                                  ) : qr.qrType === "lecture_class" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      qr.mappings.map((m, idx) => (
                                        <div key={idx}>
                                          {m.classVal ? `${m.classVal.toUpperCase()} > ` : ""}
                                          {m.program ? `${m.program} > ` : ""}
                                          {m.subject} > {m.chapterName || m.chapterId} > Lecture Class: {(qr as any).lectureClassId || m.lectureClassId || "N/A"}
                                        </div>
                                      ))
                                    ) : (
                                      <div>Lecture Class</div>
                                    )
                                  ) : qr.qrType === "live_exam" ? (
                                    Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                      qr.mappings.map((m, idx) => (
                                        <div key={idx}>
                                          {m.classVal ? `${m.classVal.toUpperCase()} > ` : ""}
                                          {m.program ? `${m.program} > ` : ""}
                                          {m.subject} > {m.chapterName || m.chapterId} > Live Exam: {(qr as any).liveExamId || m.liveExamId || "N/A"}
                                        </div>
                                      ))
                                    ) : (
                                      <div>Live Exam</div>
                                    )
                                  ) : Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                                    qr.mappings.map((m, idx) => (
                                      <div key={idx}>
                                        {m.classVal ? `${m.classVal.toUpperCase()} > ` : ""}
                                        {m.program ? `${m.program} > ` : ""}
                                        {m.subject} > {m.chapterName || m.chapterId || "Chapter"}
                                      </div>
                                    ))
                                  ) : (
                                    <div>
                                      {qr.program ? `${qr.program} > ` : ""}
                                      {qr.subject} > {qr.chapterName || qr.chapterId || "Chapter"}
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell>
                          {qr.qrType === "quiz" || qr.qrType === "shikho_ai" || qr.qrType === "animated_video" ? (
                            <Badge className="bg-green-500">
                              <span className="mr-2">●</span>
                              Live
                            </Badge>
                          ) : Array.isArray(qr.mappings) && qr.mappings.length > 0 ? (
                            (() => {
                              const allReady = qr.mappings?.every((m) => m.isContentReady)
                              return (
                                <Badge
                                  variant={allReady ? "default" : "secondary"}
                                  className={allReady ? "bg-green-500" : "bg-yellow-500"}
                                >
                                  <span className="mr-2">●</span>
                                  {allReady ? "Live" : "Fallback Active"}
                                </Badge>
                              )
                            })()
                          ) : (
                            <Badge
                              variant={qr.isContentReady ? "default" : "secondary"}
                              className={qr.isContentReady ? "bg-green-500" : "bg-yellow-500"}
                            >
                              <span className="mr-2">●</span>
                              {qr.isContentReady ? "Live" : "Fallback Active"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Pencil
                            className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-purple-600"
                            onClick={() => handleEdit(qr)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : activeMenu === "quiz" ? (
          <div className="mt-0">
            <QRQuizBuilder quizDatabase={quizDatabase} setQuizDatabase={setQuizDatabase} />
          </div>
        ) : activeMenu === "stock" ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Filter by Class</Label>
                    <Select
                      value={stockFilterClass}
                      onValueChange={(value) => {
                        setStockFilterClass(value)
                        // Reset dependent filters when class changes
                        setStockFilterGroup("all")
                        setStockFilterProgram("all")
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {CLASS_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Filter by Group</Label>
                    <Select
                      value={stockFilterGroup}
                      onValueChange={setStockFilterGroup}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {GROUP_OPTIONS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Filter by Program</Label>
                    <Select
                      value={stockFilterProgram}
                      onValueChange={setStockFilterProgram}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {Array.from(new Set(bookStock.map((s) => s.program))).map((program) => (
                          <SelectItem key={program} value={program}>
                            {program}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Book Stock Inventory</CardTitle>
                <Button
                  onClick={openAddStockDialog}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Stock
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Program</TableHead>
                      <TableHead>Available Stock</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBookStock.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No stock records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedBookStock.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.classVal}</TableCell>
                          <TableCell>{record.group || "-"}</TableCell>
                          <TableCell>{record.program}</TableCell>
                          <TableCell>{record.availableStock.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-purple-600"
                              onClick={() => openEditStockDialog(record)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
                  <div>
                    Total{" "}
                    <span className="font-medium text-foreground">
                      {filteredBookStock.length}
                    </span>{" "}
                    item{filteredBookStock.length === 1 ? "" : "s"}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={stockPage <= 1 || filteredBookStock.length === 0}
                        onClick={() => setStockPage((prev) => Math.max(1, prev - 1))}
                      >
                        {"<"}
                      </Button>
                      {stockPageNumbers.map((page, idx) =>
                        page === "ellipsis" ? (
                          <span key={`ellipsis-${idx}`} className="px-1">
                            ...
                          </span>
                        ) : (
                          <Button
                            key={page}
                            variant={page === stockPage ? "default" : "outline"}
                            size="icon"
                            className={`h-7 w-7 text-xs ${
                              page === stockPage ? "bg-purple-600 text-white hover:bg-purple-700" : ""
                            }`}
                            onClick={() => setStockPage(page)}
                          >
                            {page}
                          </Button>
                        ),
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={
                          filteredBookStock.length === 0 ||
                          stockPage >= totalStockPages
                        }
                        onClick={() =>
                          setStockPage((prev) =>
                            Math.min(totalStockPages, prev + 1),
                          )
                        }
                      >
                        {">"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={String(stockPageSize)}
                        onValueChange={(value) => {
                          const size = Number(value) || 10
                          setStockPageSize(size)
                          setStockPage(1)
                        }}
                      >
                        <SelectTrigger className="h-7 w-[90px] px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 / page</SelectItem>
                          <SelectItem value="20">20 / page</SelectItem>
                          <SelectItem value="50">50 / page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="max-w-3xl">
              <CardHeader>
                <CardTitle>Bulk Manage QR Access via CSV</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with <code>user_id</code>, <code>academic_program_id</code>, and{" "}
                  <code>is_qr</code> (<code>TRUE</code>/<code>FALSE</code>) columns to grant or revoke QR
                  scanner access. Granting access will check and decrement the book stock.
                </p>

                <Button variant="outline" onClick={handleDownloadTemplate}>
                  Download CSV Template
                </Button>

                <div
                  className="mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted transition-colors"
                  onClick={openAccessForm}
                >
                  <div className="text-3xl mb-2">☁️⬆️</div>
                  <p className="font-medium text-sm">
                    Click here to add a new upload (title, description, and CSV)
                  </p>
                </div>

                {csvStatus === "error" && (
                  <div className="mt-4 rounded-md border px-4 py-3 text-sm border-destructive/40 bg-destructive/10 text-destructive">
                    <p className="font-semibold">Error</p>
                    <p className="mt-1">Please upload a valid .csv file.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upload History */}
            <Card>
              <CardHeader>
                <CardTitle>Upload History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">ID</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Created Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="pr-6 text-center">Failure Log</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No uploads yet. Upload a CSV file to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      uploadHistory.map((batch) => {
                        const hasFailures = batch.status === "Completed" && batch.failedRows.length > 0
                        return (
                          <TableRow key={batch.id}>
                            <TableCell className="pl-6">
                              <div className="font-mono text-xs font-medium">{batch.id}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{batch.title ?? batch.fileName}</div>
                            </TableCell>
                            <TableCell className="text-sm">{batch.createdBy}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                              {formatBatchTimestamp(batch.createdTime)}
                            </TableCell>
                            <TableCell>
                              {batch.status === "Pending" && (
                                <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-100">
                                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
                                  Pending
                                </Badge>
                              )}
                              {batch.status === "Processing" && (
                                <Badge className="bg-blue-100 text-blue-800 border border-blue-300 hover:bg-blue-100">
                                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                  Processing
                                </Badge>
                              )}
                              {batch.status === "Completed" && (
                                <Badge className="bg-green-100 text-green-800 border border-green-300 hover:bg-green-100">
                                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                                  Completed
                                </Badge>
                              )}
                              {batch.status === "Failed" && (
                                <Badge className="bg-red-100 text-red-800 border border-red-300 hover:bg-red-100">
                                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                                  Failed
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="pr-6 text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      disabled={!hasFailures}
                                      onClick={() => hasFailures && handleDownloadFailureLog(batch)}
                                      className={
                                        hasFailures
                                          ? "text-destructive hover:text-destructive hover:bg-red-50"
                                          : "text-muted-foreground/30 cursor-not-allowed"
                                      }
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {hasFailures
                                      ? `Download failure log (${batch.failedRows.length} failed row${batch.failedRows.length !== 1 ? "s" : ""})`
                                      : batch.status === "Completed"
                                        ? "No failures — nothing to download"
                                        : "Available once processing completes"}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {activeMenu === "generate" && (
        <QRFormSheet
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleSubmit}
          editingQR={editingQR}
          quizDatabase={quizDatabase}
        />
      )}

      <QRSuccessDialog open={isSuccessOpen} onOpenChange={setIsSuccessOpen} qrData={currentQR} />

      {/* Book Stock Add / Edit Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStock ? "Update Existing Stock" : "Add New Stock Record"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Class <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={stockClass}
                  onValueChange={(value) => {
                    if (editingStock) return
                    setStockClass(value)
                    setStockGroup("")
                    setStockProgram("")
                  }}
                  disabled={!!editingStock}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASS_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {GROUP_CLASSES.has(stockClass) && (
                <div className="space-y-1.5">
                  <Label>
                    Group <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={stockGroup}
                    onValueChange={setStockGroup}
                    disabled={!!editingStock}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUP_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Program <span className="text-destructive">*</span>
              </Label>
              <Select
                value={stockProgram}
                onValueChange={setStockProgram}
                disabled={!stockClass || !!editingStock}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={stockClass ? "Select program" : "Select class first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableProgramsForSelectedClass.length === 0 ? (
                    <SelectItem value={stockProgram || "custom"} disabled>
                      No programs available for this class
                    </SelectItem>
                  ) : (
                    availableProgramsForSelectedClass.map((program) => (
                      <SelectItem key={program} value={program}>
                        {program}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                {editingStock ? "New Stock Quantity" : "Quantity"}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                placeholder="e.g., 500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStockDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleStockSubmit}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Access upload form: Title, Description, CSV */}
      <Dialog open={isAccessFormOpen} onOpenChange={setIsAccessFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New CSV Upload</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="access-form-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="access-form-title"
                value={accessFormTitle}
                onChange={(e) => setAccessFormTitle(e.target.value)}
                placeholder="e.g. February batch – Class 9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-form-description">Description</Label>
              <Textarea
                id="access-form-description"
                value={accessFormDescription}
                onChange={(e) => setAccessFormDescription(e.target.value)}
                placeholder="Optional notes about this upload"
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CSV file <span className="text-destructive">*</span></Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => accessFormFileInputRef.current?.click()}
              >
                <div className="text-2xl mb-1">☁️⬆️</div>
                <p className="text-sm font-medium text-muted-foreground">
                  Click to browse or drag &amp; drop a .csv file
                </p>
                {accessFormFile && (
                  <p className="mt-2 text-xs font-medium text-foreground">Selected: {accessFormFile.name}</p>
                )}
              </div>
              <input
                ref={accessFormFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleAccessFormFileChange}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccessFormOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleAccessFormSubmit}
              disabled={!accessFormTitle.trim() || !accessFormFile}
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
