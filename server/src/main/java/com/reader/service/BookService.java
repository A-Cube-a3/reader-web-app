package com.reader.service;

import com.reader.model.Book;
import com.reader.repository.BookRepository;
import com.reader.storage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class BookService {

    private static final Logger logger = LoggerFactory.getLogger(BookService.class);

    private final BookRepository bookRepository;
    private final FileStorageService fileStorageService;

    public BookService(BookRepository bookRepository, FileStorageService fileStorageService) {
        this.bookRepository = bookRepository;
        this.fileStorageService = fileStorageService;
    }

    /**
     * Handles the full upload flow:
     * 1. Detects file type (PDF or EPUB)
     * 2. Saves file to local storage
     * 3. Persists metadata to MongoDB
     *
     * @param file the uploaded multipart file
     * @return the saved Book document
     * @throws IOException              if the file cannot be stored
     * @throws IllegalArgumentException if the file type is unsupported
     */
    public Book uploadBook(MultipartFile file) throws IOException {
        String originalFileName = file.getOriginalFilename();
        logger.debug("Processing upload for file: {}", originalFileName);

        String fileType = detectFileType(originalFileName);
        String storedFilePath = fileStorageService.saveFile(file);

        String title = deriveTitle(originalFileName);

        Book book = Book.builder()
                .title(title)
                .type(fileType)
                .filePath(storedFilePath)
                .originalFileName(originalFileName)
                .fileSize(file.getSize())
                .uploadedAt(LocalDateTime.now())
                .build();

        Book savedBook = bookRepository.save(book);
        logger.info("Book saved to MongoDB with id: {}", savedBook.getId());

        return savedBook;
    }

    /**
     * This retrieves all books from the database.
     */
    public List<Book> getAllBooks() {
        return bookRepository.findAll();
    }

    /**
     * Retrieves a single book by its ID.
     */
    public Optional<Book> getBookById(String id) {
        return bookRepository.findById(id);
    }

    /**
     * Detects the file type based on the file extension.
     *
     * @param fileName the original file name
     * @return "PDF" or "EPUB"
     * @throws IllegalArgumentException if the extension is not supported
     */
    private String detectFileType(String fileName) {
        if (fileName == null) {
            throw new IllegalArgumentException("File name must not be null");
        }

        String lowerName = fileName.toLowerCase();

        if (lowerName.endsWith(".pdf")) {
            return "PDF";
        } else if (lowerName.endsWith(".epub")) {
            return "EPUB";
        } else {
            throw new IllegalArgumentException(
                    "Unsupported file type. Only PDF and EPUB files are accepted. Received: " + fileName
            );
        }
    }

    /**
     * Derives a human-readable title from the file name by stripping the extension.
     */
    private String deriveTitle(String fileName) {
        if (fileName == null) return "Unknown";
        int dotIndex = fileName.lastIndexOf(".");
        return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    }
}
