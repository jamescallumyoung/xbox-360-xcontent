import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js'
import './components/app-shell.js'

setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn')

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
