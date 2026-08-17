package com.reader.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "books")
public class Book {

    @Id
    private String id;

    private String title;

    private String type;       // PDF or EPUB

    private String filePath;   // Path where file is stored on disk

    private String originalFileName;

    private long fileSize;     // Size in bytes

    private LocalDateTime uploadedAt;

    public Book() {
    }

    public Book(String id, String title, String type, String filePath, String originalFileName,
                long fileSize, LocalDateTime uploadedAt) {
        this.id = id;
        this.title = title;
        this.type = type;
        this.filePath = filePath;
        this.originalFileName = originalFileName;
        this.fileSize = fileSize;
        this.uploadedAt = uploadedAt;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public String getOriginalFileName() {
        return originalFileName;
    }

    public void setOriginalFileName(String originalFileName) {
        this.originalFileName = originalFileName;
    }

    public long getFileSize() {
        return fileSize;
    }

    public void setFileSize(long fileSize) {
        this.fileSize = fileSize;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(LocalDateTime uploadedAt) {
        this.uploadedAt = uploadedAt;
    }
}
