package com.reader.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Logger logger = LoggerFactory.getLogger(FileStorageService.class);

    private final Path storageLocation;

    public FileStorageService(@Value("${file.storage.path}") String storagePath) {
        this.storageLocation = Paths.get(storagePath).toAbsolutePath().normalize();
        createStorageDirectoryIfNotExists();
    }

    /**
     * Creates the storage directory if it does not already exist.
     */
    private void createStorageDirectoryIfNotExists() {
        try {
            Files.createDirectories(this.storageLocation);
            logger.info("Storage directory initialized at: {}", this.storageLocation);
        } catch (IOException e) {
            throw new RuntimeException("Could not create storage directory at: " + this.storageLocation, e);
        }
    }

    /**
     * Saves the given file to local storage using a UUID-based filename.
     *
     * @param file the uploaded multipart file
     * @return the absolute path string where the file was stored
     * @throws IOException if the file cannot be written
     */
    public String saveFile(MultipartFile file) throws IOException {
        String originalFileName = file.getOriginalFilename();
        String extension = getFileExtension(originalFileName);
        String storedFileName = UUID.randomUUID().toString() + extension;

        Path targetPath = this.storageLocation.resolve(storedFileName);
        Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);

        logger.info("File saved: {} -> {}", originalFileName, targetPath);
        return targetPath.toString();
    }

    /**
     * Extracts the file extension from the original filename.
     *
     * @param fileName the original file name
     * @return the extension including dot (e.g. ".pdf"), or empty string if none
     */
    private String getFileExtension(String fileName) {
        if (fileName == null || !fileName.contains(".")) {
            return "";
        }
        return fileName.substring(fileName.lastIndexOf("."));
    }

    /**
     * Returns the root storage location path.
     */
    public Path getStorageLocation() {
        return storageLocation;
    }
}
