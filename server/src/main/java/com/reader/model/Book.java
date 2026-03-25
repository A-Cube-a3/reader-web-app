package com.reader.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
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
}
