import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Footer } from './Footer'
import { Onboarding } from './Onboarding'

type UploadScreenProps = {
  onFiles: (files: File[]) => void
  isLoading: boolean
  error?: string
  onTryAgain: () => void
  onLookupInstead?: () => void
}

type FileSystemEntryLike = {
  isFile: boolean
  isDirectory: boolean
  file?: (callback: (file: File) => void, errorCallback?: () => void) => void
  createReader?: () => {
    readEntries: (
      callback: (entries: FileSystemEntryLike[]) => void,
      errorCallback?: () => void,
    ) => void
  }
}
type DirectoryReaderLike = {
  readEntries: (
    callback: (entries: FileSystemEntryLike[]) => void,
    errorCallback?: () => void,
  ) => void
}

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null
}

function readAllEntries(
  reader: DirectoryReaderLike,
): Promise<FileSystemEntryLike[]> {
  return new Promise((resolve) => {
    const entries: FileSystemEntryLike[] = []
    const readBatch = () =>
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) resolve(entries)
          else {
            entries.push(...batch)
            readBatch()
          }
        },
        () => resolve(entries),
      )
    readBatch()
  })
}

async function filesFromEntry(entry: FileSystemEntryLike): Promise<File[]> {
  if (entry.isFile && entry.file) {
    return new Promise((resolve) =>
      entry.file?.(
        (file) => resolve([file]),
        () => resolve([]),
      ),
    )
  }
  if (entry.isDirectory && entry.createReader) {
    const entries = await readAllEntries(entry.createReader())
    return (await Promise.all(entries.map(filesFromEntry))).flat()
  }
  return []
}

async function droppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items) as DataTransferItemWithEntry[]
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean) as FileSystemEntryLike[]
  if (entries.length > 0)
    return (await Promise.all(entries.map(filesFromEntry))).flat()
  return Array.from(dataTransfer.files)
}

export function UploadScreen({
  onFiles,
  isLoading,
  error,
  onTryAgain,
  onLookupInstead,
}: UploadScreenProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const [isDragging, setIsDragging] = useState(false)

  const submitInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    if (files.length > 0) onFiles(files)
    event.currentTarget.value = ''
  }
  const submitDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    if (isLoading) return
    const files = await droppedFiles(event.dataTransfer)
    if (files.length > 0) onFiles(files)
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-400">
          Mutuals
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          A clearer picture of your connections.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
          Compare the follower and following lists in your Instagram data
          export.
        </p>
        <p className="mt-4 font-semibold text-slate-900 dark:text-white">
          Your file is read in your browser and never uploaded.
        </p>
      </div>

      {error ? (
        <section
          role="alert"
          className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={onTryAgain}
            className="mt-3 rounded-md font-semibold underline decoration-2 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-rose-600"
          >
            Try another file
          </button>
        </section>
      ) : null}

      <div
        role="region"
        aria-label="Instagram export upload"
        aria-describedby="upload-instructions"
        onDragEnter={(event) => {
          event.preventDefault()
          if (!isLoading) {
            dragDepth.current += 1
            setIsDragging(true)
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1)
          if (dragDepth.current === 0) setIsDragging(false)
        }}
        onDrop={submitDrop}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-12 ${isDragging ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'}`}
      >
        {isLoading ? (
          <p
            className="text-lg font-semibold text-slate-900 dark:text-white"
            aria-live="polite"
          >
            Reading your export…
          </p>
        ) : (
          <>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              Drop your ZIP, JSON files, or export folder here
            </p>
            <p
              id="upload-instructions"
              className="mt-2 text-sm text-slate-600 dark:text-slate-300"
            >
              Or choose what you downloaded from Instagram.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                Choose file
              </button>
              <button
                type="button"
                onClick={() => folderInput.current?.click()}
                className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
              >
                Choose folder
              </button>
            </div>
          </>
        )}
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept=".zip,.json,application/zip,application/json"
          multiple
          onChange={submitInput}
        />
        <input
          ref={folderInput}
          className="sr-only"
          type="file"
          multiple
          onChange={submitInput}
          {...({ webkitdirectory: '' } as Record<string, string>)}
        />
      </div>

      <details className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
        <summary className="cursor-pointer font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600">
          How do I get my export?
        </summary>
        <ol className="mt-4 list-decimal space-y-2 pl-5 leading-6">
          <li>
            In Instagram, open <strong>Accounts Center</strong>, then{' '}
            <strong>Your information and permissions</strong>, then{' '}
            <strong>Download your information</strong>.
          </li>
          <li>
            Request your information and choose <strong>JSON</strong>, not HTML.
          </li>
          <li>
            Choose <strong>Followers and following</strong>, or request all of
            your information.
          </li>
          <li>
            Instagram will email you a download link. It can take a little
            while.
          </li>
          <li>
            Download it, then drag the ZIP here—no need to unzip it first.
          </li>
        </ol>
      </details>
      {onLookupInstead ? (
        <button
          type="button"
          onClick={onLookupInstead}
          className="mt-5 self-center text-sm text-slate-600 underline decoration-slate-400 underline-offset-4 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 dark:text-slate-300 dark:hover:text-indigo-300"
        >
          Advanced: look up a public username with your own Apify token →
        </button>
      ) : null}
      <Onboarding />
      <Footer />
    </main>
  )
}
