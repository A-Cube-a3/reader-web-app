---

## ⚙️ Prerequisites

| Tool       | Version  |
|------------|----------|
| Java       | 17+      |
| Maven      | 3.8+     |
| Node.js    | 18+      |
| MongoDB    | 6+       |

---

## 🚀 Run Instructions

### 1. Start MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Windows
net start MongoDB
```

Confirm it's running:
```bash
mongosh
# should open a Mongo shell connected to localhost:27017
```

---

### 2. Start the Backend

```bash
cd reader-app/backend

mvn spring-boot:run
```

You should see:
```
Started ReaderAppApplication on port 8080
```

A `./storage/` folder will be created automatically at `reader-app/backend/storage/`.

---

### 3. Start the Frontend

```bash
cd reader-app/frontend

npm install

npm run dev
```

Frontend available at: **http://localhost:5173**

---

## 🧪 Testing the Upload

### Option A — Browser UI

1. Open http://localhost:5173
2. Click the file input and choose a `.pdf` or `.epub` file
3. Click **Upload Book**
4. The response JSON will appear below the button

### Option B — curl

```bash
curl -X POST http://localhost:8080/api/books/upload \
  -F "file=@/path/to/your/book.pdf"
```

Expected response (201 Created):
```json
{
  "id": "64ab1234...",
  "title": "my-book",
  "type": "PDF",
  "filePath": "/absolute/path/storage/uuid.pdf",
  "originalFileName": "my-book.pdf",
  "fileSize": 204800,
  "uploadedAt": "2024-01-15T10:30:00"
}
```

### Option C — GET all books

```bash
curl http://localhost:8080/api/books
```

---

## 🔌 API Endpoints

| Method | Endpoint                   | Description            |
|--------|----------------------------|------------------------|
| POST   | `/api/books/upload`        | Upload a PDF or EPUB   |
| GET    | `/api/books`               | List all books         |
| GET    | `/api/books/{id}`          | Get book by ID         |

---

## 🗃️ MongoDB

- **Database**: `readerapp`
- **Collection**: `books`

View saved books:
```bash
mongosh
use readerapp
db.books.find().pretty()
```

---

## 📝 Notes

- Uploaded files are stored in `backend/storage/` with a UUID filename
- Only `.pdf` and `.epub` files are accepted
- File size limit: 100MB (configurable in `application.properties`)
- No authentication in Phase 1
