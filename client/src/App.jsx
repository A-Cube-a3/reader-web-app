import { useState, useEffect } from 'react'


function App() {
  const [status, setStatus] = useState("Loading...")
  useEffect(() => {
    fetch("http://localhost:8080/health")
      .then(res => res.text())
      .then(data => setStatus(data))
      .catch(()=> setStatus("Cant reach the backend :("))
  } , [])
  return (
    <div style={{ padding: "2rem", fontFamily: "Arial" }}>
      <h1>📚 Reader App</h1>
      <p>{status}</p>
    </div>
  )
}

export default App
