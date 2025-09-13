import '../styles/LoadingSpinner.css'

function LoadingSpinner({ size = 'medium', message = 'Loading...', fullScreen = false }) {
  const sizeClass = {
    small: 'spinner-small',
    medium: 'spinner-medium', 
    large: 'spinner-large'
  }[size] || 'spinner-medium'

  const spinner = (
    <div className={`loading-spinner ${sizeClass}`}>
      <div className="spinner-circle"></div>
      {message && <div className="spinner-message">{message}</div>}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="loading-overlay">
        {spinner}
      </div>
    )
  }

  return spinner
}

export default LoadingSpinner