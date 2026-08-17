package com.reader.exception;

public class BookStorageException extends RuntimeException {
    public BookStorageException(String message, Throwable cause) {
        super(message, cause);
    }

    public BookStorageException(String message) {
        super(message);
    }
}
