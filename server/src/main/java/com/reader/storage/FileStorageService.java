package com.reader.storage;

import com.reader.config.ReaderProperties;
import com.reader.exception.BookStorageException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Logger logger = LoggerFactory.getLogger(FileStorageService.class);

    private final Path storageLocation;

    public FileStorageService(ReaderProperties readerProperties) {
        this.storageLocation = readerProperties.storage().path().toAbsolutePath().normalize();
        createStorageDirectoryIfNotExists();
    }

    /**
     * Creates the storage directory if it does not already exist.
     */
    private void createStorageDirectoryIfNotExists() {
        try {
            Files.createDirectories(this.storageLocation);
            logger.info("Legacy upload storage initialized");
        } catch (IOException e) {
            throw new BookStorageException("Could not initialize legacy upload storage", e);
        }
    }

    /**
     * Saves the given file to local storage using a UUID-based filename.
     *
     * @param file the uploaded multipart file
     * @return the absolute path string where the file was stored
     */
    public String saveFile(MultipartFile file, String fileType) {
        String storedFileName = UUID.randomUUID() + "." + fileType.toLowerCase();

        Path targetPath = this.storageLocation.resolve(storedFileName).normalize();
        if (!targetPath.startsWith(this.storageLocation)) {
            throw new BookStorageException("Invalid legacy upload storage target");
        }

        try {
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            logger.info("Stored legacy upload with generated name {}", storedFileName);
            return targetPath.toString();
        } catch (IOException exception) {
            throw new BookStorageException("Could not write legacy upload", exception);
        }
    }

    public void deleteFile(String storedFilePath) {
        Path targetPath = Path.of(storedFilePath).toAbsolutePath().normalize();
        if (!targetPath.startsWith(this.storageLocation)) {
            throw new BookStorageException("Refusing to delete a file outside legacy upload storage");
        }

        try {
            Files.deleteIfExists(targetPath);
        } catch (IOException exception) {
            throw new BookStorageException("Could not remove legacy upload", exception);
        }
    }

    /**
     * Returns the root storage location path.
     */
    public Path getStorageLocation() {
        return storageLocation;
    }
}
