package com.reader.storage;

import com.reader.config.ReaderProperties;
import com.reader.exception.BookStorageException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileStorageServiceTest {

    @TempDir
    Path storageDirectory;

    @Test
    void storesWithGeneratedNameAndDeletesManagedFile() throws Exception {
        FileStorageService storage = storageService();
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "../../private.pdf",
                "application/pdf",
                "contents".getBytes()
        );

        String storedPath = storage.saveFile(file, "PDF");
        Path target = Path.of(storedPath);

        assertThat(target).startsWith(storageDirectory.toAbsolutePath());
        assertThat(target.getFileName().toString()).matches("[0-9a-f-]+\\.pdf");
        assertThat(Files.readString(target)).isEqualTo("contents");

        storage.deleteFile(storedPath);
        assertThat(target).doesNotExist();
    }

    @Test
    void refusesToDeleteOutsideManagedStorage() {
        FileStorageService storage = storageService();
        Path outside = storageDirectory.getParent().resolve("outside.pdf");

        assertThatThrownBy(() -> storage.deleteFile(outside.toString()))
                .isInstanceOf(BookStorageException.class)
                .hasMessageContaining("outside legacy upload storage");
    }

    private FileStorageService storageService() {
        ReaderProperties properties = new ReaderProperties(
                new ReaderProperties.Storage(storageDirectory),
                new ReaderProperties.Cors(List.of("http://localhost:5173"))
        );
        return new FileStorageService(properties);
    }
}
