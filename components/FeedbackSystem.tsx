import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

interface FeedbackNote {
  id: string
  page_url: string
  component_path: string | null
  x_position: number | null
  y_position: number | null
  title: string
  description: string | null
  status: 'complete' | 'incomplete'
  tester_name: string | null
  tab_name: string | null
  created_at: string
  images?: FeedbackImage[]
}

interface FeedbackImage {
  id: string
  feedback_note_id: string
  image_url: string
  created_at: string
}

type FilterType = 'all' | 'complete' | 'incomplete' | 'page'

export default function FeedbackSystem() {
  const router = useRouter()
  const [isFeedbackMode, setIsFeedbackMode] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [notes, setNotes] = useState<FeedbackNote[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(false)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null)
  const [noteForm, setNoteForm] = useState({
    title: '',
    description: '',
    tester_name: '',
    component_path: '',
    tab_name: ''
  })
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [selectedNote, setSelectedNote] = useState<FeedbackNote | null>(null)
  const [showNoteDetail, setShowNoteDetail] = useState(false)

  // Fetch notes on mount and when filter changes
  useEffect(() => {
    fetchNotes()
  }, [filter, router.pathname])

  const fetchNotes = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('feedback_notes')
        .select(`
          *,
          images:feedback_images(*)
        `)
        .order('created_at', { ascending: false })

      // Apply filter
      if (filter === 'complete') {
        query = query.eq('status', 'complete')
      } else if (filter === 'incomplete') {
        query = query.eq('status', 'incomplete')
      } else if (filter === 'page') {
        query = query.eq('page_url', router.pathname)
      }

      const { data, error } = await query

      if (error) throw error
      setNotes(data || [])
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageClick = (e: React.MouseEvent) => {
    if (!isFeedbackMode) return

    // Prevent triggering on buttons and form elements
    if ((e.target as HTMLElement).closest('button, input, select, textarea, a, [role="button"]')) {
      return
    }

    setSelectedPosition({ x: e.pageX, y: e.pageY })
    setShowNoteForm(true)

    // Get component path (CSS selector of clicked element)
    const element = e.target as HTMLElement
    const path = getElementPath(element)
    
    // Detect which tab if on MAR page
    let tabName = ''
    if (router.pathname === '/mar') {
      // Check which tab button has the active styling (border-blue-600)
      const tabButtons = Array.from(document.querySelectorAll('button.px-6.py-3.font-medium'))
      const activeButton = tabButtons.find(btn => {
        const el = btn as HTMLElement
        const style = window.getComputedStyle(el)
        return style.borderBottomColor === 'rgb(37, 99, 235)' // blue-600
      })
      
      if (activeButton) {
        const text = activeButton.textContent?.toLowerCase() || ''
        if (text.includes('medication')) tabName = 'medications'
        else if (text.includes('vital signs')) tabName = 'vitals'
        else if (text.includes('prn')) tabName = 'prn'
      }
    }
    
    setNoteForm(prev => ({ ...prev, component_path: path, tab_name: tabName }))
  }

  const getElementPath = (element: HTMLElement): string => {
    const path: string[] = []
    let current: HTMLElement | null = element

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase()
      
      if (current.id) {
        selector += `#${current.id}`
        path.unshift(selector)
        break
      } else if (current.className) {
        const classes = Array.from(current.classList).slice(0, 2).join('.')
        if (classes) selector += `.${classes}`
      }

      // Add position in parent
      const siblings = Array.from(current.parentElement?.children || [])
      const index = siblings.indexOf(current)
      if (index > 0 && siblings.length > 1) {
        selector += `:nth-child(${index + 1})`
      }

      // Special handling for MAR page to capture tab context
      const textContent = current.textContent?.trim().toLowerCase()
      if (textContent && (textContent.includes('vital signs') || textContent.includes('medications') || textContent.includes('prn'))) {
        path.unshift(selector)
        break
      }

      path.unshift(selector)
      current = current.parentElement
    }

    return path.join(' > ')
  }

  // Check if an element is in a specific MAR tab based on component path
  const isInMarTab = (componentPath: string | null, tabName: string): boolean => {
    if (!componentPath) return false
    const path = componentPath.toLowerCase()
    return path.includes(tabName.toLowerCase())
  }

  const handleSubmitNote = async () => {
    if (!noteForm.title.trim()) {
      alert('Please enter a title')
      return
    }

    try {
      // Create note
      const { data: note, error: noteError } = await supabase
        .from('feedback_notes')
        .insert([{
          page_url: router.pathname,
          component_path: noteForm.component_path,
          x_position: selectedPosition?.x,
          y_position: selectedPosition?.y,
          title: noteForm.title,
          description: noteForm.description || null,
          tester_name: noteForm.tester_name || null,
          tab_name: noteForm.tab_name || null,
          status: 'incomplete'
        }])
        .select()
        .single()

      if (noteError) throw noteError

      // Upload images if any
      if (imageFiles.length > 0 && note) {
        const uploadPromises = imageFiles.map(async (file) => {
          const fileName = `${note.id}/${Date.now()}-${file.name}`
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('feedback-images')
            .upload(fileName, file)

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('feedback-images')
            .getPublicUrl(fileName)

          // Save image URL to database
          await supabase
            .from('feedback_images')
            .insert([{
              feedback_note_id: note.id,
              image_url: publicUrl
            }])
        })

        await Promise.all(uploadPromises)
      }

      // Reset form and fetch updated notes
      setShowNoteForm(false)
      setSelectedPosition(null)
      setNoteForm({ title: '', description: '', tester_name: '', component_path: '', tab_name: '' })
      setImageFiles([])
      fetchNotes()
      setIsFeedbackMode(false)
    } catch (error) {
      console.error('Error submitting note:', error)
      alert('Error submitting note. Please try again.')
    }
  }

  const toggleNoteStatus = async (noteId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'complete' ? 'incomplete' : 'complete'
      const { error } = await supabase
        .from('feedback_notes')
        .update({ status: newStatus })
        .eq('id', noteId)

      if (error) throw error
      fetchNotes()
    } catch (error) {
      console.error('Error toggling note status:', error)
    }
  }

  const navigateToNote = async (note: FeedbackNote) => {
    // Navigate to the page
    await router.push(note.page_url)
    
    // Wait for page to load, then scroll to element and highlight
    setTimeout(() => {
      if (note.component_path) {
        try {
          const element = document.querySelector(note.component_path)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            // Add temporary highlight
            element.classList.add('feedback-highlight')
            setTimeout(() => {
              element.classList.remove('feedback-highlight')
            }, 3000)
          }
        } catch (error) {
          console.error('Error finding element:', error)
        }
      }
    }, 500)
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setIsFeedbackMode(!isFeedbackMode)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
      >
        {isFeedbackMode ? (
          <>
            <span className="text-lg">✕</span>
            <span>Cancel</span>
          </>
        ) : (
          <>
            <span className="text-lg">📝</span>
            <span>Feedback Mode</span>
          </>
        )}
      </button>

      {/* Floating dashboard button */}
      <button
        onClick={() => setShowDashboard(!showDashboard)}
        className="fixed bottom-6 right-44 z-50 bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
      >
        <span className="text-lg">📋</span>
        <span>Dashboard</span>
      </button>

      {/* Feedback overlay when in feedback mode */}
      {isFeedbackMode && (
        <div
          className="fixed inset-0 z-40 bg-transparent cursor-crosshair"
          onClick={handlePageClick}
          style={{ pointerEvents: 'all' }}
        >
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-black px-6 py-3 rounded-lg shadow-lg">
            🎯 Click anywhere on the page to add a note
          </div>
        </div>
      )}

      {/* Note form modal */}
      {showNoteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">Add Feedback Note</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Brief title for this note"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={noteForm.description}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={5}
                  placeholder="Detailed description of the issue or feedback..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Your Name (Optional)</label>
                <input
                  type="text"
                  value={noteForm.tester_name}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, tester_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Screenshots</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setImageFiles(Array.from(e.target.files || []))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {imageFiles.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {imageFiles.map((file, idx) => (
                      <div key={idx} className="text-sm text-gray-600">
                        📷 {file.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSubmitNote}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Submit Note
                </button>
                <button
                  onClick={() => {
                    setShowNoteForm(false)
                    setSelectedPosition(null)
                    setNoteForm({ title: '', description: '', tester_name: '', component_path: '', tab_name: '' })
                    setImageFiles([])
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating dashboard */}
      {showDashboard && (
        <div className="fixed right-6 top-6 bottom-24 z-50 bg-white rounded-lg shadow-2xl w-96 border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">Feedback Dashboard</h3>
              <button
                onClick={() => setShowDashboard(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('incomplete')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'incomplete' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Incomplete
              </button>
              <button
                onClick={() => setFilter('complete')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'complete' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Complete
              </button>
              <button
                onClick={() => setFilter('page')}
                className={`px-3 py-1 rounded text-sm ${
                  filter === 'page' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                This Page
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No notes found</div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer ${
                      note.status === 'complete' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                    onClick={() => navigateToNote(note)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-sm flex-1">{note.title}</h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleNoteStatus(note.id, note.status)
                        }}
                        className={`ml-2 text-lg ${
                          note.status === 'complete' ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {note.status === 'complete' ? '✓' : '○'}
                      </button>
                    </div>
                    {note.description && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">{note.description}</p>
                    )}
                    {note.images && note.images.length > 0 && (
                      <div className="flex gap-1 mb-2">
                        {note.images.slice(0, 3).map((img) => (
                          <img
                            key={img.id}
                            src={img.image_url}
                            alt="Note screenshot"
                            className="w-12 h-12 object-cover rounded border"
                          />
                        ))}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 flex items-center justify-between">
                      <span>{note.page_url}</span>
                      {note.tester_name && <span>by {note.tester_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual markers for notes on current page */}
      {notes
        .filter(note => {
          if (note.page_url !== router.pathname || !note.x_position || !note.y_position) {
            return false
          }
          
          // For MAR page, only show markers if they match the current tab
          if (router.pathname === '/mar' && note.tab_name) {
            // Check which tab button has the active styling (border-blue-600)
            const tabButtons = Array.from(document.querySelectorAll('button.px-6.py-3.font-medium'))
            const activeButton = tabButtons.find(btn => {
              const el = btn as HTMLElement
              const style = window.getComputedStyle(el)
              return style.borderBottomColor === 'rgb(37, 99, 235)' // blue-600
            })
            
            if (activeButton) {
              const text = activeButton.textContent?.toLowerCase()
              if (note.tab_name === 'vitals' && !text?.includes('vital signs')) return false
              if (note.tab_name === 'medications' && !text?.includes('medication')) return false
              if (note.tab_name === 'prn' && !text?.includes('prn')) return false
            }
          }
          
          return true
        })
        .map((note) => (
          <div
            key={note.id}
            className="feedback-marker"
            style={{
              left: `${note.x_position}px`,
              top: `${note.y_position}px`,
              backgroundColor: note.status === 'complete' ? '#10b981' : '#3b82f6'
            }}
            title={note.title}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedNote(note)
              setShowNoteDetail(true)
            }}
          />
        ))}

      {/* Note detail modal */}
      {showNoteDetail && selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-2xl font-bold">{selectedNote.title}</h3>
              <button
                onClick={() => {
                  setShowNoteDetail(false)
                  setSelectedNote(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              {selectedNote.description && (
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedNote.description}</p>
                </div>
              )}
              {selectedNote.images && selectedNote.images.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Screenshots</label>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedNote.images.map((img) => (
                      <img
                        key={img.id}
                        src={img.image_url}
                        alt="Note screenshot"
                        className="w-full rounded border border-gray-300"
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Page: {selectedNote.page_url}</span>
                {selectedNote.tester_name && <span>by {selectedNote.tester_name}</span>}
              </div>
              <button
                onClick={() => {
                  setShowNoteDetail(false)
                  setSelectedNote(null)
                  navigateToNote(selectedNote)
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Note Location
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

