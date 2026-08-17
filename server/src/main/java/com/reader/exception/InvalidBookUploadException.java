package com.reader.exception;

public class InvalidBookUploadException extends RuntimeException {
    public InvalidBookUploadException(String message) {
        super(message);
    }
}
