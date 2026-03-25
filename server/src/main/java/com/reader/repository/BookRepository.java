package com.reader.repository;

import com.reader.model.Book;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookRepository extends MongoRepository<Book, String> {

    List<Book> findByType(String type);

    List<Book> findByTitleContainingIgnoreCase(String title);
}
