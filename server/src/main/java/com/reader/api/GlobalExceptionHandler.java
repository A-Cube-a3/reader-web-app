package com.reader.api;

import com.reader.exception.BookNotFoundException;
import com.reader.exception.BookStorageException;
import com.reader.exception.InvalidBookUploadException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(InvalidBookUploadException.class)
    public ResponseEntity<ApiError> handleInvalidUpload(
            InvalidBookUploadException exception,
            HttpServletRequest request
    ) {
        return response(HttpStatus.BAD_REQUEST, "INVALID_BOOK_UPLOAD", exception.getMessage(), request);
    }

    @ExceptionHandler(BookNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(
            BookNotFoundException exception,
            HttpServletRequest request
    ) {
        return response(HttpStatus.NOT_FOUND, "BOOK_NOT_FOUND", exception.getMessage(), request);
    }

    @ExceptionHandler({MissingServletRequestPartException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ApiError> handleMissingUpload(HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "MISSING_FILE", "A book file is required", request);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> handleOversizedUpload(HttpServletRequest request) {
        return response(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "BOOK_TOO_LARGE",
                "The uploaded book exceeds the configured size limit",
                request
        );
    }

    @ExceptionHandler(BookStorageException.class)
    public ResponseEntity<ApiError> handleStorageFailure(
            BookStorageException exception,
            HttpServletRequest request
    ) {
        logger.error("Legacy book storage operation failed", exception);
        return response(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "BOOK_STORAGE_ERROR",
                "The server could not store the book",
                request
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpectedFailure(Exception exception, HttpServletRequest request) {
        logger.error("Unexpected request failure", exception);
        return response(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "The request could not be completed",
                request
        );
    }

    private ResponseEntity<ApiError> response(
            HttpStatus status,
            String code,
            String message,
            HttpServletRequest request
    ) {
        ApiError error = new ApiError(Instant.now(), status.value(), code, message, request.getRequestURI());
        return ResponseEntity.status(status).body(error);
    }
}
