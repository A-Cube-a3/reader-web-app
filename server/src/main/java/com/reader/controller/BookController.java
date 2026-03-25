package com.reader.controller;

import com.reader.model.Book;
import com.reader.service.BookService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private static final Logger logger = LoggerFactory.getLogger(BookController.class);

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    /**
     * POST /api/books/upload
     * Accepts a multipart file, stores it, and returns saved metadata.
     */
    @PostMapping("/upload")
    public ResponseEntity<?> uploadBook(@RequestParam("file") MultipartFile file) {
        logger.info("Received upload request for file: {}", file.getOriginalFilename());

        if (file.isEmpty()) {
            return ResponseEntity
                    .badRequest()
                    .body(Map.of("error", "File must not be empty"));
        }

        try {
            Book savedBook = bookService.uploadBook(file);
            return ResponseEntity.status(HttpStatus.CREATED).body(savedBook);
        } catch (IllegalArgumentException e) {
            logger.warn("Invalid file upload attempt: {}", e.getMessage());
            return ResponseEntity
                    .badRequest()
                    .body(Map.of("error", e.getMessage()));
        } catch (IOException e) {
            logger.error("Failed to store file: {}", e.getMessage(), e);
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to store file: " + e.getMessage()));
        }
    }

    /**
     * GET /api/books
     * Returns all uploaded books.
     */
    @GetMapping
    public ResponseEntity<List<Book>> getAllBooks() {
        List<Book> books = bookService.getAllBooks();
        return ResponseEntity.ok(books);
    }

    /**
     * GET /api/books/{id}
     * Returns a single book by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getBookById(@PathVariable String id) {
        Optional<Book> book = bookService.getBookById(id);
        if (book.isPresent()) {
            return ResponseEntity.ok(book.get());
        }
        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(Map.of("error", "Book not found with id: " + id));
    }
}
