package com.reader.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Profiles;
import org.springframework.util.StringUtils;

import java.util.List;

public class ProductionEnvironmentValidator implements EnvironmentPostProcessor {

    private static final List<String> REQUIRED_PRODUCTION_VARIABLES = List.of(
            "MONGODB_URI",
            "BOOK_STORAGE_PATH",
            "CORS_ALLOWED_ORIGINS"
    );

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!environment.acceptsProfiles(Profiles.of("prod"))) {
            return;
        }

        List<String> missingVariables = REQUIRED_PRODUCTION_VARIABLES.stream()
                .filter(variable -> !StringUtils.hasText(environment.getProperty(variable)))
                .toList();

        if (!missingVariables.isEmpty()) {
            throw new IllegalStateException(
                    "Missing required production environment variables: " + String.join(", ", missingVariables)
            );
        }
    }
}
