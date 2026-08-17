package com.reader.service;

import com.reader.exception.InvalidBookUploadException;
import com.reader.model.Book;
import com.reader.repository.BookRepository;
import com.reader.storage.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BookServiceTest {

    private BookRepository bookRepository;
    private FileStorageService fileStorageService;
    private BookService bookService;

    @BeforeEach
    void setUp() {
        bookRepository = mock(BookRepository.class);
        fileStorageService = mock(FileStorageService.class);
        bookService = new BookService(bookRepository, fileStorageService);
    }

    @Test
    void uploadsPdfWithNormalizedMetadata() {
        MockMultipartFile file = bookFile("C:\\fakepath\\A Book.pdf", "pdf");
        when(fileStorageService.saveFile(file, "PDF")).thenReturn("/managed/book.pdf");
        when(bookRepository.save(org.mockito.ArgumentMatchers.any(Book.class)))
                .thenAnswer(invocation -> {
                    Book book = invocation.getArgument(0);
                    book.setId("book-id");
                    return book;
                });

        Book result = bookService.uploadBook(file);

        assertThat(result.getId()).isEqualTo("book-id");
        assertThat(result.getTitle()).isEqualTo("A Book");
        assertThat(result.getType()).isEqualTo("PDF");
        assertThat(result.getOriginalFileName()).isEqualTo("A Book.pdf");
        assertThat(result.getFilePath()).isEqualTo("/managed/book.pdf");
    }

    @Test
    void acceptsEpubExtensionCaseInsensitively() {
        MockMultipartFile file = bookFile("novel.EPUB", "epub");
        when(fileStorageService.saveFile(file, "EPUB")).thenReturn("/managed/book.epub");
        when(bookRepository.save(org.mockito.ArgumentMatchers.any(Book.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Book result = bookService.uploadBook(file);

        assertThat(result.getType()).isEqualTo("EPUB");
        assertThat(result.getTitle()).isEqualTo("novel");
    }

    @Test
    void rejectsUnsupportedFileBeforeWriting() {
        MockMultipartFile file = bookFile("notes.txt", "text");

        assertThatThrownBy(() -> bookService.uploadBook(file))
                .isInstanceOf(InvalidBookUploadException.class)
                .hasMessage("Only PDF and EPUB files are accepted");

        verify(fileStorageService, never()).saveFile(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        verify(bookRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rejectsEmptyFileBeforeWriting() {
        MockMultipartFile file = new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]);

        assertThatThrownBy(() -> bookService.uploadBook(file))
                .isInstanceOf(InvalidBookUploadException.class)
                .hasMessage("The book file must not be empty");

        verify(fileStorageService, never()).saveFile(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void deletesStoredFileWhenMetadataPersistenceFails() {
        MockMultipartFile file = bookFile("book.pdf", "pdf");
        when(fileStorageService.saveFile(file, "PDF")).thenReturn("/managed/book.pdf");
        when(bookRepository.save(org.mockito.ArgumentMatchers.any(Book.class)))
                .thenThrow(new IllegalStateException("database unavailable"));

        assertThatThrownBy(() -> bookService.uploadBook(file))
                .isInstanceOf(IllegalStateException.class);

        verify(fileStorageService).deleteFile("/managed/book.pdf");
    }

    private MockMultipartFile bookFile(String fileName, String content) {
        return new MockMultipartFile(
                "file",
                fileName,
                "application/octet-stream",
                content.getBytes(StandardCharsets.UTF_8)
        );
    }
}
