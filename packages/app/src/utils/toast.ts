export function showToast(message: string, variant: 'primary' | 'warning' | 'danger' = 'warning') {
  const alert = Object.assign(document.createElement('sl-alert'), {
    variant,
    closable: true,
    duration: 10000,
  })
  alert.innerHTML = message
  document.body.appendChild(alert)
  // @ts-ignore — .toast() is present on sl-alert at runtime
  return alert.toast()
}
