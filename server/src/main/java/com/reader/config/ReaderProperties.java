package com.reader.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.nio.file.Path;
import java.util.List;

@Validated
@ConfigurationProperties(prefix = "reader")
public record ReaderProperties(
        @Valid @NotNull Storage storage,
        @Valid @NotNull Cors cors
) {
    public record Storage(@NotNull Path path) {
    }

    public record Cors(@NotEmpty List<@NotBlank String> allowedOrigins) {
        public Cors {
            allowedOrigins = allowedOrigins == null ? List.of() : List.copyOf(allowedOrigins);
        }
    }
}
