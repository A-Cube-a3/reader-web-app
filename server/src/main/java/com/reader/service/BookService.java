package com.reader.service;

import com.reader.exception.InvalidBookUploadException;
import com.reader.model.Book;
import com.reader.repository.BookRepository;
import com.reader.storage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
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
     */
    public Book uploadBook(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new InvalidBookUploadException("The book file must not be empty");
        }

        String originalFileName = normalizeFileName(file.getOriginalFilename());

        String fileType = detectFileType(originalFileName);
        String storedFilePath = fileStorageService.saveFile(file, fileType);

        String title = deriveTitle(originalFileName);

        Book book = new Book(
                null,
                title,
                fileType,
                storedFilePath,
                originalFileName,
                file.getSize(),
                LocalDateTime.now()
        );

        try {
            Book savedBook = bookRepository.save(book);
            logger.info("Stored legacy book metadata with id {}", savedBook.getId());
            return savedBook;
        } catch (RuntimeException persistenceFailure) {
            try {
                fileStorageService.deleteFile(storedFilePath);
            } catch (RuntimeException cleanupFailure) {
                persistenceFailure.addSuppressed(cleanupFailure);
            }
            throw persistenceFailure;
        }
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
    @SuppressWarnings("null")
    public Optional<Book> getBookById(String id) {
        return bookRepository.findById(id);
    }

    /**
     * Detects the file type based on the file extension.
     *
     * @param fileName the original file name
     * @return "PDF" or "EPUB"
     */
    private String detectFileType(String fileName) {
        String lowerName = fileName.toLowerCase(Locale.ROOT);

        if (lowerName.endsWith(".pdf")) {
            return "PDF";
        } else if (lowerName.endsWith(".epub")) {
            return "EPUB";
        } else {
            throw new InvalidBookUploadException("Only PDF and EPUB files are accepted");
        }
    }

    private String normalizeFileName(String fileName) {
        if (fileName == null || fileName.isBlank()) {
            throw new InvalidBookUploadException("The book must have a file name");
        }

        String normalized = fileName.replace('\\', '/');
        normalized = normalized.substring(normalized.lastIndexOf('/') + 1).trim();
        if (normalized.isBlank() || normalized.equals(".") || normalized.equals("..")) {
            throw new InvalidBookUploadException("The book must have a valid file name");
        }
        return normalized;
    }

    /**
     * Derives a human-readable title from the file name by stripping the extension.
     */
    private String deriveTitle(String fileName) {
        int dotIndex = fileName.lastIndexOf(".");
        return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    }
}
