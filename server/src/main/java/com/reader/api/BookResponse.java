package com.reader.api;

import com.reader.model.Book;

import java.time.LocalDateTime;

public record BookResponse(
        String id,
        String title,
        String type,
        String originalFileName,
        long fileSize,
        LocalDateTime uploadedAt
) {
    public static BookResponse from(Book book) {
        return new BookResponse(
                book.getId(),
                book.getTitle(),
                book.getType(),
                book.getOriginalFileName(),
                book.getFileSize(),
                book.getUploadedAt()
        );
    }
}
