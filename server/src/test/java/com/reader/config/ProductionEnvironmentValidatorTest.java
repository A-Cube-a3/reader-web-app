package com.reader.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ProductionEnvironmentValidatorTest {

    private final ProductionEnvironmentValidator validator = new ProductionEnvironmentValidator();

    @Test
    void ignoresMissingCloudConfigurationOutsideProduction() {
        assertThatCode(() -> validator.postProcessEnvironment(new MockEnvironment(), null))
                .doesNotThrowAnyException();
    }

    @Test
    void namesMissingProductionVariablesWithoutValues() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        environment.setProperty("MONGODB_URI", "mongodb://configured");

        assertThatThrownBy(() -> validator.postProcessEnvironment(environment, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage(
                        "Missing required production environment variables: "
                                + "BOOK_STORAGE_PATH, CORS_ALLOWED_ORIGINS"
                );
    }
}
