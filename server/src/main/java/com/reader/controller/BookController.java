package com.reader.controller;

import com.reader.api.BookResponse;
import com.reader.exception.BookNotFoundException;
import com.reader.service.BookService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/books")
public class BookController {

    private final BookService bookService;

    public BookController(BookService bookService) {
        this.bookService = bookService;
    }

    /**
     * POST /api/books/upload
     * Accepts a multipart file, stores it, and returns saved metadata.
     */
    @PostMapping("/upload")
    public ResponseEntity<BookResponse> uploadBook(@RequestParam("file") MultipartFile file) {
        BookResponse response = BookResponse.from(bookService.uploadBook(file));
        return ResponseEntity.status(HttpStatus.CREATED)
                .header("Deprecation", "true")
                .header("X-Reader-Legacy-Endpoint", "Local import replaces this endpoint in Phase 2")
                .body(response);
    }

    /**
     * GET /api/books
     * Returns all uploaded books.
     */
    @GetMapping
    public ResponseEntity<List<BookResponse>> getAllBooks() {
        List<BookResponse> books = bookService.getAllBooks().stream().map(BookResponse::from).toList();
        return ResponseEntity.ok(books);
    }

    /**
     * GET /api/books/{id}
     * Returns a single book by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<BookResponse> getBookById(@PathVariable String id) {
        BookResponse response = bookService.getBookById(id)
                .map(BookResponse::from)
                .orElseThrow(BookNotFoundException::new);
        return ResponseEntity.ok(response);
    }
}
