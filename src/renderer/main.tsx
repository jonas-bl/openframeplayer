import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { ControlsView } from './components/ControlsView'
import { ScreenshotEditorView } from './components/ScreenshotEditorView'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root not found')

// One renderer bundle serves three windows: the full app, the pop-out controls
// (?view=controls), and the screenshot editor (?view=editor). The query param
// selects which root to mount.
const view = new URLSearchParams(window.location.search).get('view')
const Root = view === 'controls' ? ControlsView : view === 'editor' ? ScreenshotEditorView : App

createRoot(container).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
