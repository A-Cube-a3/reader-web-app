package com.reader.controller;

import com.reader.api.GlobalExceptionHandler;
import com.reader.exception.BookStorageException;
import com.reader.exception.InvalidBookUploadException;
import com.reader.model.Book;
import com.reader.service.BookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class BookControllerTest {

    private BookService bookService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        bookService = mock(BookService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new BookController(bookService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void legacyUploadReturnsSanitizedDtoAndDeprecationHeaders() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "book.pdf", "application/pdf", "pdf".getBytes()
        );
        when(bookService.uploadBook(org.mockito.ArgumentMatchers.any())).thenReturn(book());

        mockMvc.perform(multipart("/api/books/upload").file(file))
                .andExpect(status().isCreated())
                .andExpect(header().string("Deprecation", "true"))
                .andExpect(header().string("X-Reader-Legacy-Endpoint", containsString("Phase 2")))
                .andExpect(jsonPath("$.id").value("book-id"))
                .andExpect(jsonPath("$.title").value("Book"))
                .andExpect(jsonPath("$.filePath").doesNotExist());
    }

    @Test
    void invalidUploadUsesStableErrorContractWithoutEchoingFilename() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "private-name.txt", "text/plain", "text".getBytes()
        );
        when(bookService.uploadBook(org.mockito.ArgumentMatchers.any()))
                .thenThrow(new InvalidBookUploadException("Only PDF and EPUB files are accepted"));

        mockMvc.perform(multipart("/api/books/upload").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_BOOK_UPLOAD"))
                .andExpect(jsonPath("$.message").value("Only PDF and EPUB files are accepted"))
                .andExpect(content().string(not(containsString("private-name"))));
    }

    @Test
    void storageFailureDoesNotExposeInternalDetails() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "book.pdf", "application/pdf", "pdf".getBytes()
        );
        when(bookService.uploadBook(org.mockito.ArgumentMatchers.any()))
                .thenThrow(new BookStorageException("secret path /srv/private", new IOException("disk detail")));

        mockMvc.perform(multipart("/api/books/upload").file(file))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("BOOK_STORAGE_ERROR"))
                .andExpect(jsonPath("$.message").value("The server could not store the book"))
                .andExpect(content().string(not(containsString("/srv/private"))))
                .andExpect(content().string(not(containsString("disk detail"))));
    }

    @Test
    void listsBooksWithoutStoragePaths() throws Exception {
        when(bookService.getAllBooks()).thenReturn(List.of(book()));

        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("book-id"))
                .andExpect(jsonPath("$[0].filePath").doesNotExist());
    }

    @Test
    void missingBookUsesStableNotFoundContract() throws Exception {
        when(bookService.getBookById("missing")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/books/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("BOOK_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Book not found"));
    }

    private Book book() {
        return new Book(
                "book-id",
                "Book",
                "PDF",
                "/srv/private/book.pdf",
                "book.pdf",
                3,
                LocalDateTime.of(2026, 8, 17, 12, 0)
        );
    }
}
